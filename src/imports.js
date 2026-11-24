import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { parse } from "smol-toml";
import {
  check,
  credential,
  endpoint,
  own,
  plain,
  put,
  safeKey,
  serverName,
  snapshot,
  UserError,
} from "./common.js";

const max = 1024 * 1024;
function inside(root, file) {
  const rel = path.relative(root, file);
  return (
    rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel)
  );
}
const openConfig = (file) =>
  open(file, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
export function defaultCodexPath(
  codexHome = process.env.CODEX_HOME,
  home = homedir(),
) {
  return path.resolve(codexHome || path.join(home, ".codex"), "config.toml");
}
export async function detectCodexConfig() {
  const file = defaultCodexPath();
  let handle;
  try {
    handle = await openConfig(file);
    const s = await handle.stat();
    return {
      path: file,
      status: s.isFile() && s.size <= max ? "found" : "unavailable",
    };
  } catch (e) {
    return {
      path: file,
      status: e.code === "ENOENT" ? "missing" : "unavailable",
    };
  } finally {
    await handle?.close();
  }
}
async function text(file) {
  const f = await openConfig(file);
  try {
    const s = await f.stat();
    check(s.isFile() && s.size <= max, "配置必须是 1 MiB 以内的普通文件。");
    const b = Buffer.alloc(s.size + 1);
    let n = 0;
    while (n < b.length) {
      const r = await f.read(b, n, b.length - n, n);
      if (!r.bytesRead) break;
      n += r.bytesRead;
    }
    check(n === s.size, "文件已变化，请重新预览。");
    return b.subarray(0, n).toString("utf8");
  } finally {
    await f.close();
  }
}
export async function loadSource(kind, location = "") {
  check(typeof location === "string" && location.length <= 4096, "无效路径。");
  try {
    if (kind === "toml") {
      const file = location || defaultCodexPath();
      check(
        path.isAbsolute(file) && path.extname(file) === ".toml",
        "请选择宿主上的 TOML 配置绝对路径。",
      );
      return { servers: parse(await text(file)).mcp_servers, source: file };
    }
    check(
      kind === "plugin" && path.isAbsolute(location),
      "请输入宿主上的 Codex 插件目录绝对路径。",
    );
    const root = await realpath(location);
    const json = async (rel) => {
      check(
        typeof rel === "string" &&
          !path.isAbsolute(rel) &&
          !rel.split(/[\\/]/).includes("..") &&
          rel.endsWith(".json"),
        "插件声明必须引用目录内的 JSON。",
      );
      const file = await realpath(path.resolve(root, rel));
      check(inside(root, file), "插件声明不能引用目录外的文件。");
      return JSON.parse(await text(file));
    };
    const m = await json(".codex-plugin/plugin.json");
    check(plain(m), "无效的插件清单。");
    const decl = m.mcpServers;
    const raw = plain(decl) ? decl : await json(decl ?? ".mcp.json");
    return {
      servers: own(raw, "mcpServers") ? raw.mcpServers : raw,
      source: root,
      root,
    };
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError("无法读取或解析配置。请检查路径、格式和文件权限。");
  }
}
function literal(v, k) {
  check(
    typeof v === "string" &&
      v.length <= 16384 &&
      !v.includes("\0") &&
      !v.includes("${"),
    `${k} 不是可安全转换的字符串。`,
  );
  return v;
}
function envRef(k) {
  check(
    typeof k === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && safeKey(k),
    "无效的环境变量引用。",
  );
  return credential(k);
}
export function convert(name, raw, root) {
  check(serverName(name), "服务名须为 1–32 位字母、数字、下划线或连字符。");
  check(plain(raw), "服务声明不是表。");
  const stdio = own(raw, "command"),
    transport = stdio ? "stdio" : "streamable-http",
    entry = { transport, enabled: false },
    secrets = [],
    refs = [];
  const allowed = new Set([
    "enabled",
    "startup_timeout_sec",
    "startup_timeout_ms",
    "tool_timeout_sec",
    ...(stdio
      ? ["command", "args", "cwd", "env", "env_vars"]
      : [
          "url",
          "http_headers",
          "env_http_headers",
          "bearer_token_env_var",
          "auth",
        ]),
    ...(root ? ["type", ...(!stdio ? ["headers"] : [])] : []),
  ]);
  const unknown = Object.keys(raw).filter((k) => !allowed.has(k));
  check(!unknown.length, `不能等价迁移：${unknown.join(", ")}。未导入此服务。`);
  if (own(raw, "enabled"))
    check(typeof raw.enabled === "boolean", "enabled 必须是布尔值。");
  if (own(raw, "type"))
    check(
      (stdio
        ? ["stdio"]
        : ["http", "streamable_http", "streamable-http"]
      ).includes(raw.type),
      "type 与传输字段不符。",
    );
  const duration = (k, d, m) => {
    if (!own(raw, k)) return;
    const n = raw[k] * m;
    check(
      typeof raw[k] === "number" &&
        Number.isSafeInteger(n) &&
        n >= 1 &&
        n <= 2147483647,
      `${k} 超出支持范围。`,
    );
    entry[d] = n;
  };
  duration("startup_timeout_ms", "startupTimeoutMs", 1);
  duration("startup_timeout_sec", "startupTimeoutMs", 1000);
  duration("tool_timeout_sec", "toolCallTimeoutMs", 1000);
  const values = {};
  const add = (k, v, isRef = false, prefix = "") => {
    check(
      safeKey(k) &&
        (stdio
          ? /^[A-Za-z_][A-Za-z0-9_]*$/
          : /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/
        ).test(k),
      "无效的变量或请求头名称。",
    );
    check(
      !Object.keys(values).some((x) =>
        stdio ? x === k : x.toLowerCase() === k.toLowerCase(),
      ),
      `存在重复映射：${k}`,
    );
    if (isRef) {
      values[k] = prefix + envRef(v);
      refs.push(`${k} ← ${v}`);
      return;
    }
    check(
      typeof v === "string" &&
        v.length <= 16384 &&
        !v.includes("\0") &&
        (stdio || !/[\r\n]/.test(v)),
      `无效的 ${k} 值。`,
    );
    if (!v) {
      values[k] = "";
      return;
    }
    const ref = "DSH_MCP_IMPORT_" + randomUUID().replaceAll("-", "");
    secrets.push([ref, v]);
    values[k] = credential(ref);
  };
  const map = (field, asRef) => {
    if (!own(raw, field)) return;
    check(plain(raw[field]), `${field} 必须是表。`);
    for (const [k, v] of Object.entries(raw[field])) add(k, v, asRef);
  };
  if (stdio) {
    entry.command = literal(raw.command, "command");
    check(entry.command.trim(), "command 不能为空。");
    if (own(raw, "args")) {
      check(Array.isArray(raw.args), "args 必须是数组。");
      entry.args = raw.args.map((a) => literal(a, "args"));
    }
    if (own(raw, "cwd")) {
      const cwd = literal(raw.cwd, "cwd");
      check(
        cwd && (root || path.isAbsolute(cwd)),
        "普通配置的相对 cwd 需要先改为绝对路径。",
      );
      entry.cwd = root ? path.resolve(root, cwd) : cwd;
    }
    map("env", false);
    if (own(raw, "env_vars")) {
      check(Array.isArray(raw.env_vars), "env_vars 必须是数组。");
      for (const v of raw.env_vars) {
        if (plain(v)) {
          check(
            Object.keys(v).every((k) => ["source", "name"].includes(k)) &&
              (!own(v, "source") || v.source === "local"),
            "不支持远端 env_vars。",
          );
          add(v.name, v.name, true);
        } else add(v, v, true);
      }
    }
    entry.env = values;
  } else {
    check(!own(raw, "auth") || raw.auth === "oauth", "不能迁移此 auth 模式。");
    entry.url = endpoint(literal(raw.url, "url")).href;
    check(
      !new URL(entry.url).search,
      "含查询参数的 URL 可能带有凭据，请手动配置。",
    );
    map("http_headers", false);
    map("headers", false);
    map("env_http_headers", true);
    if (own(raw, "bearer_token_env_var"))
      add("Authorization", raw.bearer_token_env_var, true, "Bearer ");
    entry.headers = values;
  }
  return {
    entry,
    secrets,
    summary: {
      name,
      transport,
      destination: stdio
        ? JSON.stringify([entry.command, ...(entry.args ?? [])])
        : entry.url,
      cwd: entry.cwd,
      keys: Object.keys(values),
      refs,
      sourceDisabled: raw.enabled === false,
    },
  };
}
import { statics } from "./static.js";
function occupied(ctx, f) {
  return new Set([
    ...Object.keys(f.servers),
    ...ctx.mcpManager.list().map((r) => r.name),
    ...statics(ctx).map((r) => r.name),
  ]);
}

async function saveNew(ctx, f, chosen) {
  const stored = [];
  try {
    for (const r of chosen)
      for (const [ref, val] of r.secrets) {
        await ctx.credentials.set(ref, val);
        stored.push(ref);
      }
    await ctx.settings.mutate(
      f.ns,
      chosen.map((r) => put(["servers", r.summary.name], r.entry)),
      f.revision,
    );
  } catch (e) {
    await Promise.allSettled(stored.map((k) => ctx.credentials.unset(k)));
    throw e;
  }
}

export async function addServer(
  ctx,
  { name, transport, config, revision, enabled = true },
) {
  check(serverName(name), "服务名须为 1–32 位字母、数字、下划线或连字符。");
  check(
    transport === "stdio" || transport === "streamable-http",
    "无效的传输类型。",
  );
  check(typeof enabled === "boolean" && plain(config), "服务配置无效。");
  const stdio = transport === "stdio",
    fields = stdio
      ? ["command", "args", "cwd", "env"]
      : ["url", "http_headers"];
  check(
    own(config, stdio ? "command" : "url") &&
      Object.keys(config).every((k) => fields.includes(k)),
    "配置字段与传输类型不符。",
  );
  const f = snapshot(ctx);
  check(f.revision === revision, "配置已变化，请刷新后重试。");
  check(!occupied(ctx, f).has(name), "同名服务已存在，不覆盖。");
  const r = convert(name, config);
  r.entry.enabled = enabled;
  await saveNew(ctx, f, [r]);
  return { name, enabled };
}

export function importer(ctx) {
  const plans = new Map();
  const drop = (id) => {
    clearTimeout(plans.get(id)?.timer);
    plans.delete(id);
  };
  return {
    async preview(kind, location) {
      const source = await loadSource(kind, location);
      check(plain(source.servers), "没有找到 MCP 声明。");
      const pairs = Object.entries(source.servers);
      check(pairs.length <= 256, "一次最多导入 256 项。");
      const f = snapshot(ctx),
        used = occupied(ctx, f),
        eligible = new Map();
      const rows = pairs.map(([name, raw]) => {
        if (used.has(name))
          return { name, blocked: "同名服务已存在，不覆盖。" };
        try {
          const r = convert(name, raw, source.root);
          eligible.set(name, r);
          return r.summary;
        } catch (e) {
          return {
            name,
            blocked: e instanceof UserError ? e.message : "配置格式有误。",
          };
        }
      });
      while (plans.size >= 8) drop(plans.keys().next().value);
      const id = randomUUID(),
        timer = setTimeout(() => drop(id), 300000);
      timer.unref();
      plans.set(id, { eligible, revision: f.revision, timer });
      return { id, source: source.source, rows };
    },
    async commit(id, names) {
      const plan = plans.get(id);
      check(plan, "预览已过期，请重新预览。");
      check(
        Array.isArray(names) &&
          names.length > 0 &&
          names.length <= 256 &&
          new Set(names).size === names.length,
        "请选择要导入的条目。",
      );
      const f = snapshot(ctx);
      check(f.revision === plan.revision, "配置已变化，请重新预览。");
      const live = occupied(ctx, f);
      const chosen = names.map((n) => {
        check(
          !live.has(n) && plan.eligible.has(n),
          "选项不可导入或名称已占用。",
        );
        return plan.eligible.get(n);
      });
      drop(id);
      await saveNew(ctx, f, chosen);
      return { count: names.length };
    },
    dispose() {
      for (const id of plans.keys()) drop(id);
    },
  };
}
