import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { management } from "../index.js";

function fixture(t) {
  const inherited = { transport: "stdio", command: "echo", enabled: true };
  const form = {
    ns: "mcp",
    revision: 0,
    base: { servers: { base: inherited } },
    user: { servers: { base: { enabled: false } } },
    value: { servers: { base: { ...inherited, enabled: false } } },
  };
  const entries = [
      { options: { name: "@deepseek-ai/dsh-mcp-manager", id: "mcp" } },
    ],
    stored = new Map(),
    changes = [];
  const ctx = {
    settings: {
      describe: () => [form],
      mutate: async (ns, ops, rev) => {
        assert.equal(ns, "mcp");
        assert.equal(rev, form.revision);
        for (const op of ops) {
          const [servers, n, field] = op.path;
          assert.equal(servers, "servers");
          changes.push(op);
          if (op.op === "unset") {
            assert.equal(field, undefined);
            delete form.user.servers[n];
            delete form.value.servers[n];
          } else if (field) {
            form.user.servers[n] = {
              ...form.user.servers[n],
              [field]: op.value,
            };
            form.value.servers[n] = {
              ...form.value.servers[n],
              [field]: op.value,
            };
          } else {
            form.user.servers[n] = op.value;
            form.value.servers[n] = op.value;
          }
        }
        form.revision++;
      },
    },
    credentials: { set: (k, v) => stored.set(k, v) },
    configEditor: { entries: () => entries },
    mcpManager: {
      list: () => [
        ...Object.keys(form.value.servers).map((name) => ({
          name,
          status: {
            state: form.value.servers[name].enabled ? "connected" : "disabled",
          },
        })),
        { name: "dynamic", status: { state: "connected" } },
      ],
    },
  };
  const service = management(ctx, () => {
    throw Error("unexpected OAuth callback");
  });
  t.after(() => service.dispose());
  const action = (b) => service.action({ revision: form.revision, ...b });
  return {
    ctx,
    form,
    entries,
    stored,
    changes,
    action,
    rows: async () => (await action({ action: "list" })).rows,
  };
}
test("only confirmed user-owned DSH entries can be removed; import source, siblings and credentials survive", async (t) => {
  const { form, changes, rows, action, stored } = fixture(t);
  const root = await mkdtemp(path.join(tmpdir(), "dsh-lifecycle-"));
  t.after(async () => {
    assert.equal(await realpath(root), root);
    assert.equal(path.dirname(root), tmpdir());
    await rm(root, { recursive: true });
  });
  const file = path.join(root, "config.toml"),
    source =
      '[mcp_servers.imported]\nurl="https://example.test/mcp"\n[mcp_servers.imported.http_headers]\nX-Key="fixture"';
  await writeFile(file, source);
  const plan = await action({
    action: "preview",
    kind: "toml",
    location: file,
  });
  await action({ action: "import", id: plan.id, names: ["imported"] });
  const list = await rows();
  assert.equal(list.find((r) => r.name === "imported").removal, "allowed");
  assert.equal(list.find((r) => r.name === "base").removal, "inheritedRow");
  assert.equal(list.find((r) => r.name === "dynamic").toggleable, false);
  const d = { action: "remove", name: "imported", confirmed: true },
    before = changes.length;
  for (const patch of [
    { confirmed: false },
    { revision: -1 },
    { name: "base" },
    { name: "dynamic" },
    { rowRevision: "stale-static" },
  ])
    await assert.rejects(action({ ...d, ...patch }));
  assert.equal(changes.length, before);
  await action({ action: "enable", name: "imported", enabled: true });
  const keys = [...stored];
  assert.equal(keys.length, 1);
  await action(d);
  assert.deepEqual(changes.at(-1), {
    op: "unset",
    path: ["servers", "imported"],
  });
  assert.deepEqual(Object.keys(form.value.servers), ["base"]);
  assert.equal(form.value.servers.base.enabled, false);
  assert.deepEqual([...stored], keys);
  assert.equal(await readFile(file, "utf8"), source);
});
test("a legacy entry can be disabled and re-enabled without its fiber, never deleting or toggling the bundle", async (t) => {
  const { ctx, entries, action, rows, changes } = fixture(t);
  const legacy = (name) => ({
    id: "include:old-" + name,
    options: {
      id: "old-" + name,
      name: "@deepseek-ai/dsh-mcp-client",
      config: { serverName: name, transport: "stdio", command: "echo" },
    },
    fiber: {},
  });
  const one = legacy("one"),
    two = legacy("two");
  entries.push(one, two);
  let calls = 0;
  ctx.pluginManager = {
    setPluginEnabled: async (id, enabled) => {
      assert.equal(id, one.id);
      calls++;
      one.options.disabled = !enabled;
      one.fiber = enabled ? {} : undefined;
      return { application: "applied" };
    },
  };
  const old = (await rows()).find((r) => r.name === "one");
  assert.equal(old.removal, "staticRow");
  assert.equal(old.toggleable, true);
  await assert.rejects(
    action({
      action: "remove",
      confirmed: true,
      name: "one",
      rowRevision: old.rowRevision,
    }),
  );
  const first = {
    action: "enable",
    name: "one",
    enabled: false,
    rowRevision: old.rowRevision,
  };
  await action(first);
  const off = (await rows()).find((r) => r.name === "one");
  assert.equal(off.enabled, false);
  assert.equal(off.state, "disabled");
  assert.equal(off.toggleable, true);
  await assert.rejects(action(first));
  await assert.rejects(
    action({ action: "restart", name: "one", rowRevision: off.rowRevision }),
  );
  await action({ ...first, rowRevision: off.rowRevision, enabled: true });
  assert.equal(calls, 2);
  assert.equal(two.options.disabled, undefined);
  assert.deepEqual(changes, []);
  const current = (await rows()).find((r) => r.name === "one");
  ctx.pluginManager.setPluginEnabled = async () => ({
    application: "overridden",
  });
  await assert.rejects(
    action({ ...first, rowRevision: current.rowRevision }),
    /覆盖/,
  );
});
