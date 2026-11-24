import test from "node:test";
import assert from "node:assert/strict";
import { management } from "../index.js";
function harness() {
  const e = {
    url: "https://fixture.test/mcp",
    transport: "streamable-http",
    headers: { "X-Key": "${credential:PRIVATE_TEST}" },
    enabled: true,
  };
  const f = { ns: "mcp", value: { servers: { demo: e } }, revision: 0 };
  const stored = new Map();
  const ctx = {
    settings: {
      describe: () => [f],
      mutate: async (ns, [op], rev) => {
        assert.equal(ns, f.ns);
        assert.equal(rev, f.revision++);
        e[op.path.at(-1)] = op.value;
      },
    },
    configEditor: {
      entries: () => [
        { options: { name: "@deepseek-ai/dsh-mcp-manager", id: "mcp" } },
      ],
    },
    credentials: {
      set: (k, v) => stored.set(k, v),
      describe: (k) => ({ configured: stored.has(k), writable: true }),
      unset: (k) => stored.delete(k),
    },
    mcpManager: {
      list: () => [
        {
          name: "demo",
          status: { state: "waiting-credentials", lastError: "secret detail" },
        },
        { name: "plugin", status: { state: "connected", toolCount: 3 } },
      ],
    },
  };
  return {
    s: management(ctx, () => "http://localhost/callback"),
    e,
    f,
    stored,
  };
}
test("real status only, errors/headers redacted and plugin-owned rows immutable", async () => {
  const { s } = harness();
  try {
    const data = await s.action({ action: "list" });
    assert.equal(data.rows[1].count, 3);
    assert.equal(data.rows[1].editable, false);
    assert.ok(!JSON.stringify(data).includes("secret detail"));
    await assert.rejects(
      s.action({
        action: "enable",
        name: "plugin",
        enabled: false,
        revision: 0,
      }),
    );
    await assert.rejects(
      s.action({
        action: "enable",
        name: "demo",
        enabled: false,
        revision: 10,
      }),
    );
  } finally {
    s.dispose();
  }
});
test("can bind private HTTP credential or fill a referenced missing key, not arbitrary keys", async () => {
  const { s, e, stored } = harness();
  try {
    const action = (b) => s.action({ name: "demo", revision: 0, ...b });
    assert.deepEqual(await action({ action: "missing" }), {
      refs: ["PRIVATE_TEST"],
    });
    await assert.rejects(
      action({ action: "fill", ref: "UNRELATED", value: "marker" }),
    );
    await action({ action: "fill", ref: "PRIVATE_TEST", value: "marker" });
    assert.deepEqual(await action({ action: "missing" }), { refs: [] });
    await action({
      action: "credential",
      header: "Authorization",
      value: "another-secret",
      bearer: true,
    });
    assert.ok(e.headers.Authorization.startsWith("Bearer ${credential:"));
    assert.equal(e.headers["X-Key"], "${credential:PRIVATE_TEST}");
    assert.ok([...stored.values()].includes("another-secret"));
    assert.ok(!JSON.stringify(e).includes("another-secret"));
  } finally {
    s.dispose();
  }
});
