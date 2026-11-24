import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("bundle details and Settings register the same MCP panel under their own slot keys", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const source = await readFile(
    new URL("../client.js", import.meta.url),
    "utf8",
  );
  const slots = new Map();
  runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load({ id, factory }) {
          assert.equal(id, manifest.name);
          factory((name) => {
            assert.equal(name, "react");
            return {};
          }).apply({
            effect: (fn) => fn(),
            locale: { register() {}, bind: () => (key) => key },
            slots: {
              inject: (owner, register) => {
                register();
                assert.ok(slots.has(owner));
              },
              register: (options, panel) =>
                slots.set(options.name, { options, panel }),
            },
          });
        },
      },
    },
  });
  const details = slots.get("plugins.bundle.config"),
    settings = slots.get("settings.section");
  assert.equal(details.options.key, manifest.name);
  assert.equal(settings.options.id, "mcp-desk");
  assert.equal(typeof details.panel, "function");
  assert.equal(details.panel, settings.panel);
});
