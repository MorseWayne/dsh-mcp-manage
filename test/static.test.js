import test from "node:test";
import assert from "node:assert/strict";
import { management } from "../index.js";
import { bindStatic, staticEntry } from "../src/static.js";
test("older static profile entry is visible, updates in place and preserves native namespace", async () => {
  const raw = {
      serverName: "legacy",
      transport: "streamable-http",
      url: "https://example.test/mcp",
      headers: { "X-Region": "east" },
      startupTimeoutMs: 4000,
    },
    row = {
      options: {
        id: "legacy-row",
        name: "@deepseek-ai/dsh-mcp-client",
        config: raw,
      },
      fiber: { effectiveConfig: raw },
      moduleNamespace: {
        connectionStatusOf: () => ({
          current: () => ({ state: "failed", lastError: "401" }),
        }),
      },
    };
  const ctx = {
    configEditor: {
      entries: () => [
        row,
        { options: { name: "@deepseek-ai/dsh-mcp-manager", id: "manager" } },
      ],
      edit: async (entry, change) => {
        assert.equal(entry, row);
        row.options.config = change(row.options.config);
        row.fiber.effectiveConfig = row.options.config;
      },
    },
    settings: {
      describe: () => [{ ns: "manager", revision: 0, value: { servers: {} } }],
    },
    mcpManager: { list: () => [] },
    credentials: { set: async () => {} },
  };
  const m = management(ctx, () => "http://localhost/cb");
  try {
    const [r] = (await m.action({ action: "list" })).rows;
    assert.equal(r.static, true);
    assert.equal(r.state, "failed");
    const old = staticEntry(ctx, "legacy");
    await m.action({
      action: "credential",
      revision: 0,
      rowRevision: r.rowRevision,
      name: "legacy",
      header: "Authorization",
      value: "private",
      bearer: true,
    });
    assert.equal(row.options.config.serverName, "legacy");
    assert.equal(row.options.config.expandTemplates, true);
    assert.equal(row.options.config.headers["X-Region"], "east");
    assert.equal(row.options.config.startupTimeoutMs, 4000);
    assert.match(
      row.options.config.headers.Authorization,
      /^Bearer \$\{credential:/,
    );
    await assert.rejects(bindStatic(ctx, old, {}), /已变化/);
  } finally {
    m.dispose();
  }
});
