import { createHash } from "node:crypto";
import { check, plain, serverName } from "./common.js";
// Static profile rows created by older Codex import bundles are not manager registrations.
// Keep the original row, tool namespace, raw loader expressions and reload semantics intact.
const revision = (id, c) =>
  createHash("sha256")
    .update(JSON.stringify([id, c]))
    .digest("hex");
export function statics(ctx) {
  return ctx.configEditor
    .entries()
    .filter(
      (e) =>
        e.options.name === "@deepseek-ai/dsh-mcp-client" &&
        serverName(e.options.config?.serverName),
    )
    .map((row) => {
      const raw = row.options.config,
        config = row.fiber?.effectiveConfig ?? raw;
      const module = row.moduleNamespace;
      const status = module?.connectionStatusOf?.(row.fiber)?.current() ?? {
        state: row.options.disabled ? "disabled" : "unknown",
      };
      return {
        row,
        raw,
        config,
        status,
        name: raw.serverName,
        revision: revision(row.options.id, raw),
      };
    });
}
export function staticEntry(ctx, name) {
  const matches = statics(ctx).filter((r) => r.name === name);
  check(matches.length <= 1, "静态服务重名，无法定位唯一条目。");
  return matches[0];
}
export async function bindStatic(ctx, s, headers) {
  check(
    s.row.fiber &&
      !s.row.options.disabled &&
      s.raw.transport === "streamable-http" &&
      typeof s.raw.url === "string" &&
      s.raw.url === s.config.url,
    "仅支持已启用且 URL 为字面量的静态 HTTP 配置。",
  );
  check(
    !s.raw.headers ||
      (plain(s.raw.headers) && !Object.hasOwn(s.raw.headers, "__jsExpr")),
    "不覆盖动态请求头映射。",
  );
  check(
    s.raw.expandTemplates === true ||
      !JSON.stringify([s.raw.url, s.raw.headers]).includes("${"),
    "已有未展开模板，不能安全切换凭据模式。",
  );
  await ctx.configEditor.edit(s.row, (current) => {
    check(
      revision(s.row.options.id, current) === s.revision,
      "静态配置已变化，请刷新。",
    );
    return { ...current, expandTemplates: true, headers };
  });
}
