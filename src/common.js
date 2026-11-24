export class UserError extends Error {}
export function check(condition, message) {
  if (!condition) throw new UserError(message);
}
export const own = (o, k) => Object.hasOwn(o ?? {}, k);
export const plain = (x) =>
  x !== null &&
  typeof x === "object" &&
  [null, Object.prototype].includes(Object.getPrototypeOf(x));
export const safeKey = (x) =>
  typeof x === "string" &&
  !["__proto__", "constructor", "prototype", "__jsExpr"].includes(x);
export const serverName = (x) => safeKey(x) && /^[A-Za-z0-9_-]{1,32}$/.test(x);
export function endpoint(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new UserError("无效的服务 URL。");
  }
  check(
    !u.username &&
      !u.password &&
      !u.hash &&
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(u.hostname))),
    "需要 HTTPS（仅本机回环地址允许 HTTP），且 URL 不能包含用户信息或片段。",
  );
  return u;
}
export const credential = (ref) => "${credential:" + ref + "}";
export function snapshot(ctx) {
  const rows = ctx.configEditor
    .entries()
    .filter((e) => e.options.name === "@deepseek-ai/dsh-mcp-manager");
  check(rows.length === 1, "未找到唯一的 DSH MCP 管理器。");
  const form = ctx.settings.describe().find((f) => f.ns === rows[0].options.id);
  check(form?.value?.servers, "当前 profile 不支持编辑 MCP 配置。");
  return { ns: form.ns, revision: form.revision, servers: form.value.servers };
}
export const put = (path, value) => ({ op: "set", path, value });
