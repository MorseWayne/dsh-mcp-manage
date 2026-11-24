import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defaultCodexPath, loadSource } from "../src/imports.js";
import { management } from "../index.js";
import { rm } from "node:fs/promises";

test("opening the importer locates only default file metadata, leaving parsing to preview", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "dsh-detect-"));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previous;
    assert.equal(path.dirname(root), tmpdir());
    assert.ok(path.basename(root).startsWith("dsh-detect-"));
    await rm(root, { recursive: true });
  });
  const file = path.join(root, "config.toml");
  assert.equal(
    defaultCodexPath("", root),
    path.join(root, ".codex", "config.toml"),
  );
  const service = management({}, () => {
    throw Error("Unexpected OAuth operation");
  });
  t.after(() => service.dispose());
  const detect = () => service.action({ action: "detectCodexConfig" });
  assert.deepEqual(await detect(), { path: file, status: "missing" });
  await writeFile(file, "not a TOML file [secret marker");
  assert.deepEqual(await detect(), { path: file, status: "found" });
  await assert.rejects(loadSource("toml"));
  await writeFile(file, '[mcp_servers.fixture]\ncommand = "echo"');
  assert.equal((await loadSource("toml")).source, file);
  const manual = path.join(root, "other.toml");
  await writeFile(manual, '[mcp_servers.manual]\ncommand="echo"');
  assert.equal(
    (await loadSource("toml", manual)).servers.manual.command,
    "echo",
  );
  const nested = path.join(root, "nested");
  await mkdir(path.join(nested, "config.toml"), { recursive: true });
  process.env.CODEX_HOME = nested;
  assert.deepEqual(await detect(), {
    path: path.join(nested, "config.toml"),
    status: "unavailable",
  });
});
