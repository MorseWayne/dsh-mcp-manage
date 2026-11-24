import { createHash, randomBytes } from "node:crypto";
import {
  auth,
  discoverOAuthServerInfo,
  extractWWWAuthenticateParams,
} from "@modelcontextprotocol/client";
import {
  check,
  credential,
  endpoint,
  own,
  put,
  serverName,
  snapshot,
  UserError,
} from "./common.js";

export const CALLBACK = "/dsh-mcp-manage/oauth/callback";
const ttl = 10 * 60_000;
const digest = (name, url) =>
  createHash("sha256")
    .update(JSON.stringify([name, url]))
    .digest("hex")
    .slice(0, 32);
import { staticEntry, bindStatic } from "./static.js";
function target(ctx, name) {
  check(serverName(name), "无效服务名。");
  const staticRow = staticEntry(ctx, name),
    base = snapshot(ctx);
  check(
    !staticRow || !ctx.mcpManager.list().some((r) => r.name === name),
    "静态与受管服务名称冲突。",
  );
  const form = staticRow ? { revision: staticRow.revision } : base;
  const e = staticRow
    ? staticRow.config
    : own(base.servers, name) && base.servers[name];
  check(
    e &&
      (!staticRow || (staticRow.row.fiber && !staticRow.row.options.disabled)),
    "此服务不是已启用的可编辑配置。",
  );
  check(
    e.transport === "streamable-http" && e.enabled !== false,
    "请先启用 HTTP 服务。",
  );
  check(!e.url.includes("${"), "含凭据模板的 URL 不支持浏览器登录。");
  const url = endpoint(e.url).href,
    id = digest(name, url),
    ref = "DSH_MCP_OAUTH_" + id;
  const header = `Bearer ${credential(ref)}`;
  const configured = Object.entries(e.headers ?? {}).filter(
    ([k]) => k.toLowerCase() === "authorization",
  );
  check(
    !configured.length ||
      (configured.length === 1 && configured[0][1] === header),
    "已有自定义 Authorization；请配置其凭据，不覆盖现有请求头。",
  );
  return {
    form,
    e,
    name,
    url,
    key: "dsh-mcp-manage/" + id,
    ref,
    header,
    attached:
      !!configured.length &&
      (!staticRow || staticRow.raw.expandTemplates === true),
    staticRow,
  };
}
// No ambient authorization or configured resource headers are forwarded to discovery/issuer URLs.
function oauthFetch(resource, signal) {
  return async (input, init = {}) => {
    const url = endpoint(input instanceof Request ? input.url : input);
    check(
      url.protocol === "https:" || url.origin === new URL(resource).origin,
      "拒绝不安全的 OAuth 端点。",
    );
    const response = await fetch(input, {
      ...init,
      redirect: "error",
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(12000),
        ...(init.signal ? [init.signal] : []),
      ]),
    });
    return response;
  };
}
function provider(flow) {
  return {
    redirectUrl: flow.callback,
    clientMetadata: {
      client_name: "DSH MCP manager",
      redirect_uris: [flow.callback],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    state: () => flow.state,
    saveCodeVerifier: (v) => {
      flow.verifier = v;
    },
    codeVerifier: () => flow.verifier,
    discoveryState: () => flow.discovery,
    saveDiscoveryState: (v) => {
      flow.discovery = v;
    },
    clientInformation: () => flow.client,
    saveClientInformation: (v) => {
      flow.client = v;
    },
    tokens: () => flow.tokens,
    saveTokens: (v) => {
      flow.tokens = v;
    },
    redirectToAuthorization: (u) => {
      flow.redirect = endpoint(u).href;
    },
  };
}
export function authorizations(ctx, callbackUrl, read = target) {
  const pending = new Map(),
    notes = new Map(),
    busy = new Set(),
    life = new AbortController();
  function clear(f) {
    if (pending.get(f.state) === f) pending.delete(f.state);
    clearTimeout(f.timer);
  }
  function forget(name) {
    for (const f of pending.values()) if (f.name === name) clear(f);
  }
  async function exclusive(name, fn) {
    check(!busy.has(name), "此服务已有操作进行中。");
    busy.add(name);
    try {
      return await fn();
    } finally {
      busy.delete(name);
    }
  }
  const notice = (name, text) => {
    if (notes.size > 256) notes.clear();
    notes.set(name, text);
  };
  async function commit(f) {
    const t = read(ctx, f.name);
    check(
      !life.signal.aborted && t.url === f.url && t.form.revision === f.revision,
      "配置已变化，请重新授权。",
    );
    check(
      f.tokens?.access_token && /^bearer$/i.test(f.tokens.token_type),
      "服务未签发可用的 Bearer token。",
    );
    if (!t.attached && t.staticRow)
      await bindStatic(ctx, t.staticRow, {
        ...t.staticRow.raw.headers,
        Authorization: t.header,
      });
    else if (!t.attached)
      await ctx.settings.mutate(
        t.form.ns,
        [
          put(["servers", f.name, "headers"], {
            ...t.e.headers,
            Authorization: t.header,
          }),
        ],
        t.form.revision,
      );
    const latest = read(ctx, f.name);
    check(
      latest.url === f.url && latest.attached && !life.signal.aborted,
      "凭据引用已变更。",
    );
    await ctx.credentials.modifyRecord(t.key, () => ({
      kind: "grant",
      payload: { client: f.client, tokens: f.tokens, callback: f.callback },
    }));
    await ctx.credentials.set(t.ref, f.tokens.access_token);
    // Reference changes normally reconcile automatically; restart also resets exhausted retry budgets.
    if (!t.staticRow) await ctx.mcpManager.restart(f.name);
    // Static rows remount on ConfigEditor.edit; the credential update wakes their native supervisor.
    notice(f.name, "授权已保存，正在检查连接和工具。");
  }
  async function start(name, refresh = false) {
    return exclusive(name, async () => {
      forget(name);
      const t = read(ctx, name),
        signal = AbortSignal.any([life.signal, AbortSignal.timeout(45000)]),
        fetchFn = oauthFetch(t.url, signal);
      const result = await fetchFn(t.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "dsh-mcp-manage", version: "0.1.0" },
          },
        }),
      });
      const challenge = extractWWWAuthenticateParams(result);
      await result.body?.cancel();
      check(
        [401, 403].includes(result.status),
        `未收到鉴权挑战（HTTP ${result.status}），请检查连接。`,
      );
      let discovery;
      try {
        discovery = await discoverOAuthServerInfo(t.url, {
          resourceMetadataUrl: challenge.resourceMetadataUrl,
          fetchFn,
        });
      } catch {
        throw new UserError(
          "未发现可用的 OAuth 元数据；请检查服务地址，或使用服务提供的 API Key / Bearer 凭据。",
        );
      }
      check(
        discovery.authorizationServerMetadata?.authorization_endpoint &&
          discovery.authorizationServerMetadata?.token_endpoint,
        "服务未公布 OAuth 授权与令牌端点，请改用服务要求的凭据。",
      );
      const callback = endpoint(callbackUrl()).href,
        prev = (await ctx.credentials.readRecord(t.key))?.payload;
      const f = {
        name,
        url: t.url,
        revision: t.form.revision,
        callback,
        discovery,
        state: randomBytes(32).toString("base64url"),
        scope: challenge.scope,
        client: prev?.callback === callback ? prev.client : undefined,
        tokens: refresh && t.attached ? prev?.tokens : undefined,
      };
      const status = await auth(provider(f), {
        serverUrl: t.url,
        scope: f.scope,
        fetchFn,
        forceReauthorization: !refresh,
      });
      if (status === "AUTHORIZED") {
        await commit(f);
        return { saved: true };
      }
      check(
        f.redirect && f.verifier && !life.signal.aborted && pending.size < 32,
        "无法启动授权，请稍后再试。",
      );
      f.timer = setTimeout(() => {
        clear(f);
        notice(name, "授权已过期，可重新发起。");
      }, ttl);
      f.timer.unref();
      pending.set(f.state, f);
      notice(name, "等待浏览器授权。");
      return { url: f.redirect };
    });
  }
  async function finish(params) {
    const f = pending.get(params.get("state"));
    check(
      f && params.getAll("state").length === 1,
      "授权已失效，请回面板重新发起。",
    );
    clear(f);
    try {
      return await exclusive(f.name, async () => {
        check(
          !params.has("error") &&
            params.getAll("code").length === 1 &&
            params.get("code"),
          "授权未完成或已取消。",
        );
        const t = read(ctx, f.name);
        check(
          t.form.revision === f.revision && t.url === f.url,
          "配置已变化，请重新授权。",
        );
        await auth(provider(f), {
          serverUrl: f.url,
          authorizationCode: params.get("code"),
          iss: params.get("iss") ?? undefined,
          fetchFn: oauthFetch(f.url, life.signal),
        });
        await commit(f);
      });
    } catch (err) {
      notice(
        f.name,
        err instanceof UserError
          ? err.message
          : "换取令牌或重连失败，请检查服务后重试。",
      );
      throw err;
    }
  }
  return {
    start,
    finish,
    note: (name) => notes.get(name),
    cancel(name) {
      forget(name);
      notice(name, "已取消等待授权。");
    },
    dispose() {
      life.abort();
      for (const f of pending.values()) clear(f);
      notes.clear();
    },
  };
}
