import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  symlink,
  rm,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { convert, loadSource, importer } from "../src/imports.js";
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-desk-test-"));
  t.after(async () => {
    assert.equal(await realpath(root), root);
    assert.equal(path.dirname(root), tmpdir());
    await rm(root, { recursive: true });
  });
  return root;
}
const ctx = () => {
  const servers = {},
    f = { revision: 10, ns: "mcp", value: { servers } };
  const values = new Map();
  return {
    configEditor: {
      entries: () => [
        { options: { name: "@deepseek-ai/dsh-mcp-manager", id: "mcp" } },
      ],
    },
    settings: {
      describe: () => [f],
      mutate: async (ns, ops, rev) => {
        assert.equal(ns, "mcp");
        assert.equal(rev, f.revision);
        for (const op of ops) servers[op.path[1]] = op.value;
        f.revision++;
      },
    },
    credentials: {
      set: (k, v) => values.set(k, v),
      unset: (k) => values.delete(k),
    },
    mcpManager: { list: () => [{ name: "reserved" }] },
    servers,
    values,
    f,
  };
};
test("TOML → redacted preview, skip occupied names, preserve siblings and save disabled in one write", async (t) => {
  const dir = await fixture(t),
    file = path.join(dir, "config.toml");
  await writeFile(
    file,
    `model='ignore'\n[mcp_servers.x]\nurl='https://example.test/mcp'\nbearer_token_env_var='AUTH'\nstartup_timeout_sec=0.5\n[mcp_servers.x.http_headers]\nX-Test='private-marker'\n[mcp_servers.x.env_http_headers]\nX-Env='ANOTHER_KEY'\n[mcp_servers.reserved]\ncommand='unused'\n[mcp_servers.bad]\ncommand='unused'\ndisabled_tools=['delete']\n`,
  );
  const c = ctx();
  c.servers.old = { command: "already-here" };
  const i = importer(c);
  t.after(() => i.dispose());
  const p = await i.preview("toml", file);
  assert.equal(c.values.size, 0);
  assert.ok(!JSON.stringify(p).includes("private-marker"));
  assert.match(p.rows[1].blocked, /同名/);
  assert.match(p.rows[2].blocked, /disabled_tools/);
  assert.equal(p.rows[0].refs.length, 2);
  await assert.rejects(i.commit(p.id, ["bad"]));
  await i.commit(p.id, ["x"]);
  assert.equal(c.servers.x.enabled, false);
  assert.equal(c.servers.x.startupTimeoutMs, 500);
  assert.equal(c.servers.x.headers.Authorization, "Bearer ${credential:AUTH}");
  assert.deepEqual([...c.values.values()], ["private-marker"]);
  assert.ok(!JSON.stringify(c.servers).includes("private-marker"));
  assert.deepEqual(c.servers.old, { command: "already-here" });
  await assert.rejects(i.commit(p.id, ["x"]));
});
test("plugin inline, relative file and default; ignores hooks; blocks escaping references", async (t) => {
  const dir = await fixture(t),
    root = path.join(dir, "plugin");
  await mkdir(path.join(root, ".codex-plugin"), { recursive: true });
  const manifest = path.join(root, ".codex-plugin/plugin.json"),
    entry = {
      local: {
        type: "stdio",
        command: "node",
        args: ["service.js"],
        cwd: "lib",
        env_vars: ["KEY"],
      },
    };
  const m = (decl) =>
    writeFile(
      manifest,
      JSON.stringify({ name: "sample", hooks: "do-not-run", mcpServers: decl }),
    );
  await m(entry);
  const load = async () => {
    const raw = await loadSource("plugin", root);
    return convert("local", raw.servers.local, raw.root).entry;
  };
  assert.equal((await load()).cwd, path.join(root, "lib"));
  await writeFile(
    path.join(root, "conf.json"),
    JSON.stringify({ mcpServers: entry }),
  );
  await m("./conf.json");
  assert.equal((await load()).env.KEY, "${credential:KEY}");
  await m(undefined);
  await writeFile(path.join(root, ".mcp.json"), JSON.stringify(entry));
  assert.equal((await load()).enabled, false);
  await m("../secret.json");
  await assert.rejects(load);
  await writeFile(path.join(dir, "else.json"), "{}");
  await symlink(path.join(dir, "else.json"), path.join(root, "external.json"));
  await m("external.json");
  await assert.rejects(load, /目录外/);
});
test("invalid transport/policy/template/credential data is not silently dropped", () => {
  for (const row of [
    { command: "x", url: "https://a" },
    { command: "x", tools: {} },
    { url: "https://a", auth: "chatgpt" },
    { url: "https://a", bearer_token: "literal" },
    { command: "${credential:X}" },
    { command: "x", env_vars: [{ name: "KEY", source: "remote" }] },
    {
      url: "https://a",
      http_headers: { authorization: "a" },
      bearer_token_env_var: "K",
    },
    { command: "x", startup_timeout_sec: -1 },
  ])
    assert.throws(() => convert("server", row));
  assert.throws(() => convert("__proto__", { command: "x" }));
});
test("stale import cannot write; settings failure rolls back new secret refs", async (t) => {
  const dir = await fixture(t),
    file = path.join(dir, "c.toml");
  await writeFile(
    file,
    `[mcp_servers.x]\ncommand='echo'\n[mcp_servers.x.env]\nKEY='marker'\n`,
  );
  const c = ctx(),
    i = importer(c);
  t.after(() => i.dispose());
  const p = await i.preview("toml", file);
  c.f.revision++;
  await assert.rejects(i.commit(p.id, ["x"]), /变化/);
  const q = await i.preview("toml", file);
  c.settings.mutate = () => {
    throw Error("conflict");
  };
  await assert.rejects(i.commit(q.id, ["x"]));
  assert.equal(c.values.size, 0);
  assert.equal(c.servers.x, undefined);
});
