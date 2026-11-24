import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { authorizations } from "../src/oauth.js";

test("401 → discovery → PKCE → credential reference → same server lists tools; stale and replay denied", async (t) => {
  let base,
    challenge,
    listed,
    starts = 0,
    exchanges = 0;
  const http = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (o, status = 200, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(JSON.stringify(o));
    };
    const path = new URL(req.url, base).pathname;
    if (path === "/mcp") {
      if (req.headers.authorization !== "Bearer example-access")
        return send({}, 401, {
          "www-authenticate": `Bearer resource_metadata="${base}/resource"`,
        });
      if (req.method !== "POST") return send({}, 405);
      const rpc = JSON.parse(body);
      if (rpc.method === "server/discover")
        return send({
          jsonrpc: "2.0",
          id: rpc.id,
          error: { code: -32601, message: "method not found" },
        });
      if (rpc.method === "initialize")
        return send({
          jsonrpc: "2.0",
          id: rpc.id,
          result: {
            protocolVersion: "2025-03-26",
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1" },
          },
        });
      if (rpc.id === undefined) {
        res.writeHead(202);
        return res.end();
      }
      return send({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          tools: [{ name: "sample", inputSchema: { type: "object" } }],
        },
      });
    }
    if (path === "/resource")
      return send({ resource: base + "/mcp", authorization_servers: [base] });
    if (path.includes("well-known"))
      return send({
        issuer: base,
        authorization_endpoint: base + "/authorize",
        token_endpoint: base + "/token",
        registration_endpoint: base + "/register",
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
      });
    if (path === "/register")
      return send({ client_id: "public-test", ...JSON.parse(body) }, 201);
    if (path === "/token") {
      exchanges++;
      const p = new URLSearchParams(body);
      if (
        createHash("sha256")
          .update(p.get("code_verifier"))
          .digest("base64url") !== challenge
      )
        return send({ error: "invalid_grant" }, 400);
      return send({
        access_token: "example-access",
        token_type: "Bearer",
        refresh_token: "example-refresh",
      });
    }
    return send({}, 404);
  });
  await new Promise((ok, fail) =>
    http.once("error", fail).listen(0, "127.0.0.1", ok),
  );
  t.after(() => {
    http.closeAllConnections();
    return new Promise((ok) => http.close(ok));
  });
  base = `http://127.0.0.1:${http.address().port}`;
  const entry = {
      transport: "streamable-http",
      url: base + "/mcp",
      headers: {},
    },
    form = { ns: "mcp", value: { servers: { demo: entry } }, revision: 1 },
    secrets = new Map(),
    records = new Map();
  const ctx = {
    configEditor: {
      entries: () => [
        { options: { name: "@deepseek-ai/dsh-mcp-manager", id: "mcp" } },
      ],
    },
    settings: {
      describe: () => [form],
      mutate: async (ns, [op], rev) => {
        assert.equal(rev, form.revision++);
        entry.headers = op.value;
      },
    },
    credentials: {
      readRecord: (k) => records.get(k),
      modifyRecord: (k, fn) => records.set(k, fn()),
      set: (k, v) => secrets.set(k, v),
    },
    mcpManager: {
      restart: async (name) => {
        starts++;
        assert.equal(name, "demo");
        const token = secrets.get(
          entry.headers.Authorization.match(/credential:(\w+)/)[1],
        );
        listed = await (
          await fetch(entry.url, {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/list",
            }),
          })
        ).json();
      },
    },
  };
  const a = authorizations(ctx, () => base + "/callback");
  t.after(() => a.dispose());
  const begin = async () => {
    const u = new URL((await a.start("demo")).url);
    assert.equal(u.searchParams.get("code_challenge_method"), "S256");
    challenge = u.searchParams.get("code_challenge");
    return new URLSearchParams({
      state: u.searchParams.get("state"),
      code: "example-code",
    });
  };
  const stale = await begin();
  form.revision++;
  await assert.rejects(a.finish(stale), /配置已变化/);
  assert.equal(exchanges, 0);
  const p = await begin();
  await assert.rejects(a.finish(new URLSearchParams({ state: "wrong" })));
  await a.finish(p);
  await assert.rejects(a.finish(p));
  assert.equal(exchanges, 1);
  assert.equal(starts, 1);
  assert.equal(listed.result.tools[0].name, "sample");
  assert.ok(!JSON.stringify(form).includes("example-access"));
  await t.test(
    "installed DSH client resolves the saved reference and discovers a real MCP tool",
    { skip: !process.env.DSH_INSTALL_DIR },
    async () => {
      const require = createRequire(
          process.env.DSH_INSTALL_DIR + "/package.json",
        ),
        { probeServer } = await import(
          require.resolve("@deepseek-ai/dsh-mcp-client")
        );
      const probeCtx = {
        get: (k) =>
          k === "credentials"
            ? { resolve: async (ref) => ({ value: secrets.get(ref) }) }
            : undefined,
      };
      const p = await probeServer(
        probeCtx,
        {
          ...entry,
          serverName: "demo",
          expandTemplates: true,
          closeTimeoutMs: 2000,
        },
        { timeoutMs: 5000 },
      );
      assert.equal(p.ok, true, p.message);
      assert.equal(p.closeConfirmed, true);
      assert.deepEqual(p.toolNames, ["sample"]);
    },
  );
});
