import { randomUUID } from "node:crypto";
import { authorizations, CALLBACK } from "./src/oauth.js";
import { detectCodexConfig, importer } from "./src/imports.js";
import { statics, staticEntry, bindStatic } from "./src/static.js";
import {
  check,
  credential,
  endpoint,
  own,
  put,
  serverName,
  snapshot,
  UserError,
} from "./src/common.js";

export const name = "dsh-mcp-manage";
export const inject = [
  "connection",
  "webServer",
  "settings",
  "configEditor",
  "mcpManager",
  "pluginManager",
  "credentials",
];
export const API = "/api/dsh-mcp-manage";
function summary(e) {
  if (!e) return {};
  let address = "";
  try {
    address = new URL(e.url).origin;
  } catch {}
  return {
    transport: e.transport,
    enabled: e.enabled !== false,
    address: e.transport === "stdio" ? e.command : address,
    keys: Object.keys(
      e.transport === "stdio" ? (e.env ?? {}) : (e.headers ?? {}),
    ),
    oauthBound: Object.values(e.headers ?? {}).some((v) =>
      /^Bearer \$\{credential:DSH_MCP_OAUTH_[0-9a-f]{32}\}$/.test(v),
    ),
    hasAuth: Object.keys(e.headers ?? {}).some(
      (k) => k.toLowerCase() === "authorization",
    ),
  };
}
function diagnosis(s) {
  const msg = s.lastError ?? "";
  if (s.state === "waiting-credentials") return "缺少配置引用的凭据。";
  if (/\b401\b|unauthorized/i.test(msg)) return "HTTP 401：服务需要有效凭据。";
  if (/\b403\b|forbidden/i.test(msg))
    return "HTTP 403：服务拒绝访问，请检查权限。";
  if (/timed? ?out|timeout/i.test(msg)) return "连接或工具发现超时。";
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg))
    return "无法连接端点，请检查地址和网络。";
  if (s.reason === "cleanup" || s.reason === "unclosed-generation")
    return "旧连接未确认关闭，可能需要重启宿主。";
  return msg ? "连接失败，请检查服务配置或查看原生 MCP 诊断。" : "";
}
export function management(ctx, callbackUrl) {
  const oauth = authorizations(ctx, callbackUrl),
    imports = importer(ctx);
  return {
    dispose() {
      oauth.dispose();
      imports.dispose();
    },
    callback: (p) => oauth.finish(p),
    async action(b) {
      check(b && typeof b.action === "string", "无效操作。");
      if (b.action === "detectCodexConfig") return detectCodexConfig();
      if (b.action === "preview") return imports.preview(b.kind, b.location);
      if (b.action === "import") return imports.commit(b.id, b.names);
      const f = snapshot(ctx),
        live = ctx.mcpManager.list();
      if (b.action === "list") {
        const staticRows = statics(ctx);
        const conflict = (n) => staticRows.some((s) => s.name === n);
        return {
          revision: f.revision,
          rows: live
            .map(({ name, status }) => ({
              name,
              state: status.state,
              count: status.toolCount,
              reason: diagnosis(status),
              note: oauth.note(name),
              waitingForCallback: oauth.waiting(name),
              editable: own(f.servers, name) && !conflict(name),
              toggleable: own(f.servers, name) && !conflict(name),
              removal: conflict(name)
                ? "nameConflict"
                : f.canRemove(name)
                  ? "allowed"
                  : own(f.servers, name)
                    ? "inheritedRow"
                    : "notUserRow",
              ...summary(own(f.servers, name) ? f.servers[name] : null),
            }))
            .concat(
              staticRows
                .filter((s) => !live.some((r) => r.name === s.name))
                .map((s) => ({
                  ...summary(s.config),
                  name: s.name,
                  static: true,
                  rowRevision: s.revision,
                  state: s.status.state,
                  count: s.status.toolCount,
                  reason: diagnosis(s.status),
                  note: oauth.note(s.name),
                  waitingForCallback: oauth.waiting(s.name),
                  enabled: !s.disabled,
                  toggleable:
                    !!s.row.id &&
                    staticRows.filter((other) => other.name === s.name)
                      .length === 1,
                  editable: false,
                  removal: "staticRow",
                })),
            ),
        };
      }
      const n = b.name;
      const s = staticEntry(ctx, n);
      check(s || b.rowRevision === undefined, "静态条目已变化，请刷新。");
      check(
        !s ||
          (!live.some((r) => r.name === n) &&
            s.revision === b.rowRevision &&
            (b.action === "enable" || (s.row.fiber && !s.disabled))),
        "静态条目已变化、已停用或名称冲突。",
      );
      check(
        serverName(n) && (s || live.some((r) => r.name === n)),
        "找不到该服务。",
      );
      const e = s ? s.config : own(f.servers, n) ? f.servers[n] : undefined;
      if (b.action === "probe") {
        check(e?.enabled !== false, "停用状态不启动服务。");
        const p = s
          ? await s.row.moduleNamespace.probeServer(s.row.fiber.ctx, s.config, {
              maxToolNames: 128,
            })
          : await ctx.mcpManager.probe(n, { maxToolNames: 128 });
        check(
          p.ok && p.closeConfirmed && !p.cleanupError,
          "探测未完成；请检查服务状态。",
        );
        return { tools: p.toolNames, truncated: p.truncated };
      }
      if (b.action === "restart") {
        check(e?.enabled !== false, "请先启用服务。");
        if (s) {
          check(
            s.status.reason !== "unclosed-generation",
            "旧连接未确认关闭，请重启宿主。",
          );
          await s.row.fiber.restart();
        } else await ctx.mcpManager.restart(n);
        return {};
      }
      check(
        e && f.revision === b.revision,
        "配置已变化或由其他插件管理，请刷新。",
      );
      if (b.action === "remove") {
        check(!s && f.canRemove(n), "只有用户新增或导入的 DSH 配置可以删除。");
        check(b.confirmed === true, "请确认删除所选服务。");
        await ctx.settings.mutate(
          f.ns,
          [{ op: "unset", path: ["servers", n] }],
          f.revision,
        );
        oauth.removed(n);
        return {};
      }
      if (b.action === "enable") {
        check(typeof b.enabled === "boolean", "无效的启停状态。");
        if (s) {
          check(s.row.id, "无法定位静态配置行。");
          const result = await ctx.pluginManager.setPluginEnabled(
            s.row.id,
            b.enabled,
          );
          check(
            result.application !== "overridden",
            "此条目的启停状态被更高优先级配置覆盖。",
          );
          check(
            ["applied", "restart-required"].includes(result.application),
            "宿主未能更改此静态条目的启停状态。",
          );
          return { restartRequired: result.application === "restart-required" };
        }
        await ctx.settings.mutate(
          f.ns,
          [put(["servers", n, "enabled"], b.enabled)],
          f.revision,
        );
        return {};
      }
      if (b.action === "login") return oauth.start(n, b.refresh === true);
      if (b.action === "finishLogin") {
        await oauth.finishManual(n, b.callbackUrl);
        return { saved: true };
      }
      if (b.action === "cancel") {
        oauth.cancel(n);
        return {};
      }
      if (b.action === "missing" || b.action === "fill") {
        const strings =
          e.transport === "stdio"
            ? [
                e.command,
                e.cwd,
                ...(e.args ?? []),
                ...Object.values(e.env ?? {}),
              ]
            : [e.url, ...Object.values(e.headers ?? {})];
        const refs = [
          ...new Set(
            strings.flatMap((s) =>
              Array.from(
                String(s ?? "").matchAll(
                  /\$\{credential:([A-Za-z_][A-Za-z0-9_]*)\}/g,
                ),
                (m) => m[1],
              ),
            ),
          ),
        ];
        check(refs.length <= 128, "单项引用过多。");
        const missing = [];
        for (const ref of refs) {
          const d = await ctx.credentials.describe(ref);
          if (!d.configured && d.writable) missing.push(ref);
        }
        if (b.action === "missing") return { refs: missing };
        check(
          missing.includes(b.ref) && !b.ref.startsWith("DSH_MCP_OAUTH_"),
          "此引用不可补填，请刷新或使用 OAuth 登录。",
        );
        check(
          typeof b.value === "string" &&
            b.value.length > 0 &&
            b.value.length <= 16384 &&
            !/[\r\n\0]/.test(b.value),
          "无效的凭据值。",
        );
        await ctx.credentials.set(b.ref, b.value);
        return {};
      }
      if (b.action === "credential") {
        check(e.transport === "streamable-http", "仅支持 HTTP 凭据绑定。");
        endpoint(e.url);
        const k = b.header,
          v = b.value;
        check(
          typeof k === "string" &&
            /^[A-Za-z][A-Za-z0-9_-]{0,80}$/.test(k) &&
            ![
              "constructor",
              "prototype",
              "host",
              "cookie",
              "content-length",
              "connection",
              "transfer-encoding",
            ].includes(k.toLowerCase()),
          "无效的凭据请求头。",
        );
        check(
          typeof v === "string" &&
            v.length > 0 &&
            v.length <= 16384 &&
            !/[\r\n\0]/.test(v),
          "无效的凭据值。",
        );
        check(typeof b.bearer === "boolean", "无效凭据类型。");
        const ref = "DSH_MCP_KEY_" + randomUUID().replaceAll("-", ""),
          headers = Object.fromEntries(
            Object.entries((s ? s.raw.headers : e.headers) ?? {}).filter(
              ([name]) => name.toLowerCase() !== k.toLowerCase(),
            ),
          );
        headers[k] = (b.bearer ? "Bearer " : "") + credential(ref);
        await ctx.credentials.set(ref, v);
        try {
          if (s) await bindStatic(ctx, s, headers);
          else
            await ctx.settings.mutate(
              f.ns,
              [put(["servers", n, "headers"], headers)],
              f.revision,
            );
        } catch (err) {
          await ctx.credentials.unset(ref);
          throw err;
        }
        return {};
      }
      throw new UserError("未知操作。");
    },
  };
}
export function apply(ctx) {
  const callbackUrl = () => new URL(CALLBACK, ctx.webServer.getOrigin()).href;
  const service = management(ctx, callbackUrl);
  ctx.effect(() => () => service.dispose());
  ctx.connection.fetch.register({
    path: API,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(req) {
      const headers = {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      };
      try {
        check(
          (req.headers.get("content-type") ?? "").split(";")[0] ===
            "application/json",
          "仅接受 JSON 请求。",
        );
        const body = await req.text();
        check(Buffer.byteLength(body) <= 65536, "请求过大。");
        const value = await service.action(JSON.parse(body));
        return Response.json(value, { headers });
      } catch (e) {
        return Response.json(
          {
            error:
              e instanceof UserError
                ? e.message
                : "操作失败：请检查配置、权限或服务端 OAuth 注册支持，刷新后重试。",
          },
          { status: 400, headers },
        );
      }
    },
  });
  // OAuth redirects arrive without the Strict owner cookie. Only a pending, expiring, one-use state may redeem a code.
  ctx.effect(() =>
    ctx.webServer.register({
      kind: "exact",
      path: CALLBACK,
      async handler(req, res) {
        let ok = false;
        try {
          check(
            req.method === "GET" &&
              req.headers.host === new URL(callbackUrl()).host,
            "无效回调。",
          );
          await service.callback(new URL(req.url, callbackUrl()).searchParams);
          ok = true;
        } catch {}
        res.writeHead(ok ? 200 : 400, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            "default-src 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(
          ok
            ? "授权已保存。请返回 DSH 查看连接和工具。"
            : "授权未完成。请返回 DSH 面板查看原因或重新授权。",
        );
      },
    }),
  );
}
