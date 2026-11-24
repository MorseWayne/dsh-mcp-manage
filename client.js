window.__ModuleLoader__.load({
  id: "dsh-mcp-manage",
  factory(require) {
    const R = require("react"),
      h = R.createElement,
      { useEffect, useState, useRef } = R;
    const zh = {
      nav: "MCP 管理",
      unknown: "状态未知",
      static: "静态配置",
      intro: "查看连接、完成授权，或从 Codex 添加服务。",
      reload: "刷新",
      import: "从 Codex 导入",
      all: "全部服务",
      attention: "需要处理",
      empty: "还没有受管服务。可从 Codex 导入第一项。",
      none: "当前没有需要处理的服务。",
      ready: "已连接",
      disabled: "已停用",
      waiting: "缺少凭据",
      failed: "连接失败",
      retrying: "重连中",
      connecting: "连接中",
      closed: "已关闭",
      tools: "个工具",
      details: "详情",
      less: "收起",
      restart: "重连",
      login: "检查并授权",
      reauth: "刷新授权",
      key: "配置凭据",
      enable: "启用",
      disable: "停用",
      probe: "查看工具",
      registered: "插件托管",
      checkAuth: "检查鉴权方式",
      authLink: "打开授权页 ↗",
      authWait: "授权页已准备好。完成后返回这里；面板会更新连接状态。",
      cancel: "取消",
      load: "正在读取连接…",
      network: "无法访问管理接口，请刷新或检查插件状态。",
      saved: "操作已提交，以连接状态为准。",
      kind: "导入来源",
      toml: "Codex 配置 · TOML",
      plugin: "Codex Plugin · MCP 声明",
      path: "宿主机上的绝对路径",
      changePath: "更改路径",
      useDefault: "使用默认路径",
      detecting: "正在检测宿主上的 Codex 配置…",
      found: "已找到 Codex 配置",
      missingFile: "未找到默认配置，可更改路径。",
      unavailable: "默认配置不可读取或不是受支持的文件，可更改路径。",
      detectFailed: "无法检测宿主路径，可手动指定。",
      customPath: "TOML 配置文件的绝对路径",
      pluginPath: "例如 /home/me/plugins/my-plugin",
      preview: "预览条目",
      review:
        "仅导入勾选项；全部以停用状态保存，不会运行命令。启用前请核对命令、目标和凭据引用。",
      apply: "导入所选",
      zero: "没有找到服务器。",
      imported: "项已导入，启用后开始连接。",
      header: "请求头名称",
      secret: "新凭据值",
      bearer: "添加 Bearer 前缀",
      save: "保存并绑定",
      keyHint: "仅替换本服务所选请求头；密钥存入 DSH 凭据库，不回显。",
      confirmEnable: "启用后将启动该命令或连接远端。确认信任此服务？",
      noTools: "服务未公布工具。",
      origin: "连接目标",
      keys: "变量 / 请求头",
      refs: "环境引用",
      moreTools: "仅显示前 128 项。",
      working: "处理中…",
      sourceOff: "源配置已停用",
      hint: "需要 OAuth 的服务会给出登录链接；仅支持 API Key 的服务请配置凭据。",
      done: "关闭导入",
      required: "请输入插件目录。",
      test: "探测会新建一次临时连接。",
      allDisabled: "导入后停用",
      settingsChanged: "配置已变化，请刷新并重试。",
      fill: "补填缺失凭据",
      shared: "这是 profile 共享引用；所有使用它的服务都会收到此值。",
      noMissing: "没有可补填的引用，请刷新状态。",
    };
    const en = {
      nav: "MCP manager",
      unknown: "Unknown",
      static: "Static configuration",
      intro: "Inspect connections, sign in, or add servers from Codex.",
      reload: "Refresh",
      import: "Import from Codex",
      all: "All servers",
      attention: "Needs attention",
      empty: "No managed servers yet. Import your first server from Codex.",
      none: "No servers need attention.",
      ready: "Connected",
      disabled: "Disabled",
      waiting: "Missing credential",
      failed: "Failed",
      retrying: "Reconnecting",
      connecting: "Connecting",
      closed: "Closed",
      tools: "tools",
      details: "Details",
      less: "Collapse",
      restart: "Reconnect",
      login: "Check & sign in",
      reauth: "Renew access",
      key: "Set credential",
      enable: "Enable",
      disable: "Disable",
      probe: "List tools",
      registered: "Plugin-owned",
      checkAuth: "Check authentication",
      authLink: "Open sign-in page ↗",
      authWait:
        "Open the sign-in page, then return here. Connection status will update.",
      cancel: "Cancel",
      load: "Reading connections…",
      network: "Management API unavailable. Refresh or check the plugin.",
      saved: "Request submitted. See connection status for the result.",
      kind: "Import source",
      toml: "Codex configuration · TOML",
      plugin: "Codex plugin · MCP declarations",
      path: "Absolute path on the host",
      changePath: "Change path",
      useDefault: "Use default path",
      detecting: "Looking for Codex configuration on the host…",
      found: "Codex configuration found",
      missingFile: "Default configuration not found. Choose another path.",
      unavailable:
        "The default configuration is unreadable or unsupported. Choose another path.",
      detectFailed: "Could not detect the host path. Enter one manually.",
      customPath: "Absolute path to a TOML configuration file",
      pluginPath: "e.g. /home/me/plugins/my-plugin",
      preview: "Preview servers",
      review:
        "Only checked servers will be saved. All start disabled. Review commands, destinations and credential references before enabling.",
      apply: "Import selected",
      zero: "No servers found.",
      imported: "imported. Enable them to connect.",
      header: "Header name",
      secret: "New credential",
      bearer: "Add Bearer prefix",
      save: "Save and bind",
      keyHint:
        "Replaces only this header on this server. Secrets stay in the DSH credential store.",
      confirmEnable:
        "This will launch the command or contact the remote endpoint. Trust and enable this server?",
      noTools: "No tools advertised.",
      origin: "Destination",
      keys: "Variables / headers",
      refs: "Environment references",
      moreTools: "Showing up to 128 tools.",
      working: "Working…",
      sourceOff: "Disabled at source",
      hint: "OAuth services provide a sign-in link. For API key services, set a credential instead.",
      done: "Close import",
      required: "Enter the plugin directory.",
      test: "Probing opens a temporary connection.",
      allDisabled: "Imported disabled",
      settingsChanged: "Configuration changed. Refresh and retry.",
      fill: "Supply missing credential",
      shared:
        "This is a profile-wide reference. Every server using it receives this value.",
      noMissing: "No writable missing references. Refresh status.",
    };
    const css = `.mcpdesk{color:var(--dsw-alias-label-primary);font:inherit;max-width:58rem;margin:auto;display:grid;gap:16px;align-content:start}.mcpdesk *{box-sizing:border-box}.mcpdesk h2,.mcpdesk h3,.mcpdesk p{margin:0}.mcpdesk h2{font-size:1.3rem;letter-spacing:-.02em}.mcpdesk small,.mcpdesk .muted{color:var(--dsw-alias-label-tertiary);font-size:.83rem}.mcpdesk header,.mcpdesk .row,.mcpdesk .bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.mcpdesk .grow{flex:1 1 12em;min-width:0;overflow-wrap:anywhere}.mcpdesk button,.mcpdesk .link,.mcpdesk select,.mcpdesk input:not([type=checkbox]){background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:6px 10px;font:inherit;font-size:.84rem}.mcpdesk button,.mcpdesk .link{cursor:pointer}.mcpdesk button:hover,.mcpdesk button[aria-pressed=true]{border-color:var(--dsw-alias-label-primary)}.mcpdesk button:disabled{opacity:.48;cursor:default}.mcpdesk :focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.mcpdesk .primary,.mcpdesk .link{color:var(--dsw-alias-state-business-primary);font-weight:600}.mcpdesk .list,.mcpdesk .box{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;overflow:hidden}.mcpdesk .item+.item{border-top:1px solid var(--dsw-alias-border-l2)}.mcpdesk .item,.mcpdesk .box{padding:14px}.mcpdesk .sub{display:grid;gap:9px;padding-top:12px;overflow-wrap:anywhere}.mcpdesk .sub label{display:grid;gap:4px}.mcpdesk .sub label.line{display:flex;align-items:center;gap:7px}.mcpdesk .badge{display:inline-flex;align-items:center;gap:5px;font-size:.8rem}.mcpdesk .badge:before{content:'';width:.45em;height:.45em;border-radius:50%;background:currentColor}.mcpdesk .connected{color:var(--dsw-alias-state-business-primary)}.mcpdesk code{font-size:.82em;white-space:pre-wrap;overflow-wrap:anywhere}.mcpdesk .notice{border-inline-start:3px solid var(--dsw-alias-state-business-primary);padding:6px 10px}.mcpdesk .preview{padding:8px 0;border-top:1px solid var(--dsw-alias-border-l2)}`;
    const api = async (b, signal) => {
      const r = await fetch(new URL("api/dsh-mcp-manage", document.baseURI), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
        signal,
      });
      let j;
      try {
        j = await r.json();
      } catch {
        throw Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw Error(j.error || `HTTP ${r.status}`);
      return j;
    };
    return {
      inject: ["slots", "locale"],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register("mcpDesk", { zh, en }));
        const t = ctx.locale.bind("mcpDesk");
        const btn = (label, click, props = {}) =>
          h("button", { type: "button", onClick: click, ...props }, label);
        function Panel() {
          const [data, setData] = useState(null),
            [message, msg] = useState(""),
            [busy, setBusy] = useState(false),
            [filter, tab] = useState(false),
            [open, setOpen] = useState(""),
            [credentials, setCredentials] = useState(""),
            [key, setKey] = useState(""),
            [missing, setMissing] = useState([]),
            [ref, chooseRef] = useState(""),
            [header, setHeader] = useState("Authorization"),
            [bearer, setBearer] = useState(true),
            [link, setLink] = useState(null),
            [toolList, setTools] = useState(null);
          const [imports, panel] = useState(false),
            [kind, type] = useState("toml"),
            [location, path] = useState(""),
            [customPath, setCustomPath] = useState(false),
            [detected, setDetected] = useState(null),
            [plan, preview] = useState(null),
            [selected, select] = useState([]);
          const life = useRef(),
            seq = useRef(0),
            lock = useRef(false);
          async function reload() {
            const id = ++seq.current,
              s = life.current.signal;
            try {
              const d = await api({ action: "list" }, s);
              if (!s.aborted && id === seq.current) setData(d);
            } catch (e) {
              if (!s.aborted && id === seq.current)
                msg(e.message || t("network"));
            }
          }
          useEffect(() => {
            life.current = new AbortController();
            reload();
            window.addEventListener("focus", reload);
            return () => {
              life.current.abort();
              window.removeEventListener("focus", reload);
            };
          }, []);
          useEffect(() => {
            if (!imports || kind !== "toml" || customPath) return;
            const controller = new AbortController();
            api({ action: "detectCodexConfig" }, controller.signal).then(
              (result) => {
                if (!controller.signal.aborted) setDetected(result);
              },
              () => {
                if (!controller.signal.aborted)
                  setDetected({ status: "error" });
              },
            );
            return () => controller.abort();
          }, [imports, kind, customPath]);
          const manual = kind === "plugin" || customPath;
          const previewPath = manual
            ? location.trim()
            : detected?.status === "found"
              ? detected.path
              : "";
          const moving =
            data?.rows.some((r) =>
              ["connecting", "reconnecting"].includes(r.state),
            ) || !!link;
          useEffect(() => {
            if (!moving) return;
            const id = setInterval(() => {
              if (!document.hidden) reload();
            }, 4000);
            return () => clearInterval(id);
          }, [moving]);
          useEffect(() => {
            if (
              link &&
              data?.rows.some(
                (r) => r.name === link.name && r.state === "connected",
              )
            )
              setLink(null);
          }, [data, link]);
          async function act(b, then) {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            msg("");
            try {
              const r = await api(
                {
                  ...b,
                  revision: data?.revision,
                  rowRevision: data?.rows.find((r) => r.name === b.name)
                    ?.rowRevision,
                },
                life.current.signal,
              );
              if (!life.current.signal.aborted) {
                if (then) then(r);
                else msg(t("saved"));
                await reload();
              }
            } catch (e) {
              if (!life.current.signal.aborted) msg(e.message || t("network"));
            } finally {
              lock.current = false;
              if (!life.current.signal.aborted) setBusy(false);
            }
          }
          const button = (label, fn, props = {}) =>
              btn(label, fn, { disabled: busy, ...props }),
            clear = () => {
              preview(null);
              select([]);
            },
            closeKey = () => {
              setCredentials("");
              setKey("");
              setMissing([]);
              chooseRef("");
            };
          const toggleRow = (n) => {
              setOpen(open === n ? "" : n);
              closeKey();
              setTools(null);
            },
            openKey = (n) => {
              closeKey();
              setOpen(n);
              setCredentials(n);
              setHeader("Authorization");
              setBearer(true);
            },
            fill = (n) =>
              act({ action: "missing", name: n }, (v) => {
                closeKey();
                if (!v.refs.length) {
                  msg(t("noMissing"));
                  return;
                }
                setOpen(n);
                setCredentials(n);
                setMissing(v.refs);
                chooseRef(v.refs[0]);
              });
          function login(r) {
            act(
              { action: "login", name: r.name, refresh: r.oauthBound },
              (v) => {
                if (v.url) setLink({ name: r.name, url: v.url });
                else msg(t("saved"));
              },
            );
          }
          const toggle = (r) => {
            if (
              !r.enabled &&
              !window.confirm(
                t("confirmEnable") + "\n" + r.name + " · " + r.address,
              )
            )
              return;
            act({ action: "enable", name: r.name, enabled: !r.enabled });
          };
          const alertRow = (r) =>
            [
              "waiting-credentials",
              "failed",
              "reconnecting",
              "closed",
            ].includes(r.state);
          const stateKey = {
            connected: "ready",
            "waiting-credentials": "waiting",
            reconnecting: "retrying",
          };
          function row(r) {
            const http = r.transport === "streamable-http",
              auth = http && r.enabled && (!r.hasAuth || r.oauthBound),
              name = r.name,
              details = open === name;
            const main =
              r.state === "disabled" && r.editable
                ? button(t("enable"), () => toggle(r), { className: "primary" })
                : r.state === "waiting-credentials" &&
                    r.editable &&
                    !r.oauthBound
                  ? button(t("fill"), () => fill(name))
                  : alertRow(r) && auth
                    ? button(
                        t(r.oauthBound ? "reauth" : "login"),
                        () => login(r),
                        { className: "primary" },
                      )
                    : alertRow(r)
                      ? button(t("restart"), () =>
                          act({ action: "restart", name }),
                        )
                      : null;
            return h(
              "article",
              { className: "item", key: name },
              h(
                "div",
                { className: "row" },
                h(
                  "div",
                  { className: "grow" },
                  h("strong", null, name),
                  h(
                    "div",
                    { className: "muted" },
                    r.transport || t("registered"),
                    r.static ? " · " + t("static") : "",
                    r.count != null ? " · " + r.count + " " + t("tools") : "",
                  ),
                ),
                h(
                  "span",
                  { className: "badge " + r.state },
                  t(stateKey[r.state] || r.state),
                ),
                main,
                button(t(details ? "less" : "details"), () => toggleRow(name), {
                  "aria-expanded": details,
                }),
              ),
              link?.name === name &&
                h(
                  "div",
                  { className: "notice sub" },
                  t("authWait"),
                  h(
                    "div",
                    { className: "bar" },
                    h(
                      "a",
                      {
                        className: "link",
                        href: link.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        referrerPolicy: "no-referrer",
                      },
                      t("authLink"),
                    ),
                    button(t("cancel"), () =>
                      act({ action: "cancel", name }, () => setLink(null)),
                    ),
                  ),
                ),
              details &&
                h(
                  "div",
                  { className: "sub" },
                  r.address &&
                    h(
                      "p",
                      null,
                      t("origin") + ": ",
                      h("code", null, r.address),
                    ),
                  r.keys?.length > 0 &&
                    h("small", null, t("keys") + ": " + r.keys.join(", ")),
                  r.reason && h("p", { className: "notice" }, r.reason),
                  r.note && h("small", null, r.note),
                  http && h("small", null, t("hint")),
                  h(
                    "div",
                    { className: "bar" },
                    auth &&
                      button(t(r.oauthBound ? "reauth" : "login"), () =>
                        login(r),
                      ),
                    http &&
                      (!r.static || r.enabled) &&
                      button(t("key"), () => openKey(name)),
                    r.enabled !== false &&
                      button(t("restart"), () =>
                        act({ action: "restart", name }),
                      ),
                    r.enabled !== false &&
                      button(
                        t("probe"),
                        () =>
                          act({ action: "probe", name }, (v) =>
                            setTools({ name, ...v }),
                          ),
                        { title: t("test") },
                      ),
                    r.editable &&
                      button(t(r.enabled ? "disable" : "enable"), () =>
                        toggle(r),
                      ),
                  ),
                  toolList?.name === name &&
                    h(
                      "code",
                      null,
                      toolList.tools.join(" · ") || t("noTools"),
                      toolList.truncated ? " · " + t("moreTools") : "",
                    ),
                  credentials === name &&
                    h(
                      "div",
                      { className: "box sub" },
                      h(
                        "small",
                        null,
                        t(missing.length ? "shared" : "keyHint"),
                      ),
                      missing.length
                        ? h(
                            "label",
                            null,
                            t("refs"),
                            h(
                              "select",
                              {
                                value: ref,
                                onChange: (e) => chooseRef(e.target.value),
                              },
                              missing.map((k) =>
                                h("option", { key: k, value: k }, k),
                              ),
                            ),
                          )
                        : h(
                            "label",
                            null,
                            t("header"),
                            h("input", {
                              value: header,
                              onChange: (e) => setHeader(e.target.value),
                            }),
                          ),
                      h(
                        "label",
                        null,
                        t("secret"),
                        h("input", {
                          type: "password",
                          autoComplete: "new-password",
                          value: key,
                          onChange: (e) => setKey(e.target.value),
                        }),
                      ),
                      !missing.length &&
                        h(
                          "label",
                          { className: "line" },
                          h("input", {
                            type: "checkbox",
                            checked: bearer,
                            onChange: (e) => setBearer(e.target.checked),
                          }),
                          t("bearer"),
                        ),
                      h(
                        "div",
                        { className: "bar" },
                        button(
                          t("save"),
                          () =>
                            act(
                              missing.length
                                ? { action: "fill", name, ref, value: key }
                                : {
                                    action: "credential",
                                    name,
                                    header,
                                    value: key,
                                    bearer,
                                  },
                              () => {
                                closeKey();
                                msg(t("saved"));
                              },
                            ),
                          { disabled: busy || !key },
                        ),
                        button(t("cancel"), closeKey),
                      ),
                    ),
                ),
            );
          }
          const importPanel =
            imports &&
            h(
              "section",
              { className: "box sub" },
              h("h3", null, t("import")),
              h(
                "label",
                null,
                t("kind"),
                h(
                  "select",
                  {
                    value: kind,
                    disabled: busy,
                    onChange: (e) => {
                      type(e.target.value);
                      setCustomPath(false);
                      setDetected(null);
                      path("");
                      clear();
                    },
                  },
                  h("option", { value: "toml" }, t("toml")),
                  h("option", { value: "plugin" }, t("plugin")),
                ),
              ),
              !manual &&
                h(
                  "div",
                  { className: "sub", role: "status" },
                  h(
                    "small",
                    null,
                    t(
                      {
                        found: "found",
                        missing: "missingFile",
                        unavailable: "unavailable",
                        error: "detectFailed",
                      }[detected?.status] || "detecting",
                    ),
                  ),
                  detected?.path && h("code", null, detected.path),
                ),
              kind === "toml" &&
                h(
                  "div",
                  { className: "bar" },
                  button(
                    t(customPath ? "useDefault" : "changePath"),
                    () => {
                      path(customPath ? "" : detected?.path || "");
                      setCustomPath(!customPath);
                      setDetected(null);
                      clear();
                    },
                    { "aria-expanded": customPath },
                  ),
                ),
              manual &&
                h(
                  "label",
                  null,
                  t("path"),
                  h("input", {
                    value: location,
                    disabled: busy,
                    placeholder: t(
                      kind === "toml" ? "customPath" : "pluginPath",
                    ),
                    onChange: (e) => {
                      path(e.target.value);
                      clear();
                    },
                  }),
                ),
              h(
                "div",
                { className: "bar" },
                button(
                  t("preview"),
                  () => {
                    clear();
                    act(
                      { action: "preview", kind, location: previewPath },
                      (v) => {
                        preview(v);
                        select([]);
                      },
                    );
                  },
                  { disabled: busy || !previewPath },
                ),
              ),
              plan &&
                h(
                  "div",
                  { className: "sub" },
                  h("small", null, plan.source),
                  h("p", null, t("review")),
                  plan.rows.length === 0 && t("zero"),
                  plan.rows.map((r) =>
                    h(
                      "div",
                      { className: "preview", key: r.name },
                      h(
                        "label",
                        { className: "line" },
                        h("input", {
                          type: "checkbox",
                          disabled: !!r.blocked || busy,
                          checked: selected.includes(r.name),
                          onChange: (e) =>
                            select(
                              e.target.checked
                                ? [...selected, r.name]
                                : selected.filter((x) => x !== r.name),
                            ),
                        }),
                        h("strong", null, r.name),
                        h("small", null, r.transport),
                      ),
                      h("code", null, r.blocked || r.destination),
                      r.cwd && h("small", null, " · cwd: " + r.cwd),
                      r.sourceDisabled &&
                        h("small", null, " · " + t("sourceOff")),
                      r.keys?.length > 0 &&
                        h(
                          "div",
                          null,
                          h(
                            "small",
                            null,
                            t("keys") + ": " + r.keys.join(", "),
                          ),
                        ),
                      r.refs?.length > 0 &&
                        h("small", null, t("refs") + ": " + r.refs.join(", ")),
                    ),
                  ),
                  button(
                    t("apply") + " (" + selected.length + ")",
                    () =>
                      act(
                        { action: "import", id: plan.id, names: selected },
                        (v) => {
                          clear();
                          panel(false);
                          tab(false);
                          msg(v.count + " " + t("imported"));
                        },
                      ),
                    {
                      disabled: busy || !selected.length,
                      className: "primary",
                    },
                  ),
                ),
            );
          const rows = (data?.rows || []).filter((r) => !filter || alertRow(r));
          return h(
            "section",
            { className: "mcpdesk" },
            h("style", null, css),
            h(
              "header",
              null,
              h(
                "div",
                { className: "grow" },
                h("h2", null, t("nav")),
                h("p", { className: "muted" }, t("intro")),
              ),
              button(t("reload"), reload),
              button(
                t(imports ? "done" : "import"),
                () => {
                  type("toml");
                  setCustomPath(false);
                  setDetected(null);
                  path("");
                  panel(!imports);
                  clear();
                },
                { className: "primary", "aria-expanded": imports },
              ),
            ),
            (message || busy) &&
              h(
                "p",
                { className: "notice", role: "status" },
                message || t("working"),
              ),
            importPanel,
            h(
              "div",
              { className: "bar" },
              button(
                t("all") + " · " + (data?.rows.length ?? "—"),
                () => tab(false),
                { "aria-pressed": !filter },
              ),
              button(
                t("attention") +
                  " · " +
                  (data?.rows.filter(alertRow).length ?? "—"),
                () => tab(true),
                { "aria-pressed": filter },
              ),
            ),
            h(
              "div",
              { className: "list" },
              rows.length
                ? rows.map(row)
                : h(
                    "p",
                    { className: "item muted" },
                    t(data ? (filter ? "none" : "empty") : "load"),
                  ),
            ),
          );
        }
        ctx.slots.inject("settings.section", () =>
          ctx.slots.register(
            {
              name: "settings.section",
              id: "mcp-desk",
              order: 46,
              label: () => t("nav"),
              locale: "mcpDesk",
            },
            Panel,
          ),
        );
      },
    };
  },
});
