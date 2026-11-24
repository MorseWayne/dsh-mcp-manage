# DSH MCP 管理

DSH Web 的独立设置页。复用当前 profile 的 MCP Manager、Settings 和凭据库，不替换原生面板，也不创建第二套 MCP 工具。目标宿主：DSH 0.2.2-rc.5、Node ≥22。

## 使用

1. 在本目录 `npm ci --ignore-scripts`；在 DSH **插件 → 添加插件** 选择这个本地目录。打开 **设置 → MCP 管理**。如安装提示需要重启，先按提示重启并刷新页面。
2. 对已启用、未登录的 HTTP 配置，点 **检查并授权 → 打开授权页**。插件向已配置的服务发无凭据的 MCP 初始化请求，验证 OAuth 发现信息；可动态注册公共客户端的服务使用授权码 + PKCE。没有 OAuth 元数据的服务改用 **详情 → 配置凭据**。只需静态 Bearer 时保留 Bearer 前缀开关；API Key 使用服务指定的请求头并取消前缀。
3. 返回同一行。只有 DSH 完成连接并同步工具后才显示「已连接」和工具数量。**查看工具**单独探测，不调用业务工具。**重连**按当前配置重新挂载；**刷新授权**尝试 refresh grant，必要时给出新的浏览器登录链接。首版不做后台定时续期。
4. **从 Codex 导入**选择来源。面板打开时自动检测并显示宿主上的 Codex 配置路径：优先 `$CODEX_HOME/config.toml`，未设置时使用 `~/.codex/config.toml`。找到后直接点 **预览条目**；找不到或想使用其他配置时，点 **更改路径** 输入 TOML 绝对路径。检测不读取配置内容，也不会执行命令或自动导入。插件模式输入宿主上的插件目录绝对路径；读取 `.codex-plugin/plugin.json` 的 `mcpServers` 内联对象、其指向的 JSON 或默认 `.mcp.json`。不加载插件代码、hooks、skills 或 marketplace，不扫描 Codex 的登录存储。
5. 检查预览、勾选、导入。**所有新服务先停用**，启用 stdio 会在宿主启动所列命令，因此只启用可信来源。已有配置和插件注册的同名服务不覆盖。预览五分钟失效；配置发生变化时重新预览。

## 映射及边界

| 来源 | DSH 行为 |
| --- | --- |
| `command/args/cwd/env`，本机 `env_vars` | stdio；插件声明的相对 cwd 按插件目录解析。普通 TOML 相对 cwd 要求先改为绝对路径。 |
| `url/http_headers/env_http_headers/bearer_token_env_var` | Streamable HTTP；支持 TLS 和本机回环 HTTP；插件声明也接受 `headers`。环境引用对应 DSH credential ref（凭据库优先于环境变量）。 |
| `startup_timeout_sec/startup_timeout_ms/tool_timeout_sec` | 换算为毫秒并检查范围。 |
| 静态 env/header 值 | 提交时写入独立凭据引用；预览仅显示键名及引用关系。命令和参数会在预览中展示，**不要把密钥放在 argv 中**。不导入带查询串的 URL。 |
| 工具 allow/deny、审批、远端执行环境、`auth=chatgpt`、自定义 OAuth 参数或其他不支持字段 | 指出具体字段并阻止该条导入。不会把受限工具集降级为无限制。 |

OAuth 支持内置管理器的可编辑配置，以及旧导入包作为独立 profile 行挂载的静态 HTTP MCP Client（URL 须为字面量）。静态行通过宿主 ConfigEditor 原位绑定引用，不创建同名实例；其启停仍由所属插件管理。插件动态注册的服务仅观察、探测或重连；agent preset 和嵌套 include 中的非 profile 行不在清单。现有自定义 Authorization 不会被 OAuth 静默覆盖。回调为 DSH Web 监听地址的 `/dsh-mcp-manage/oauth/callback`；浏览器必须能访问该地址。仅支持 HTTPS 或本机回环 HTTP；不支持设备码、DPoP、必须预注册客户端的服务或任意反向代理回调重写。授权请求目前不带服务自定义头；若端点需要额外路由头才能发现，需使用其静态凭据接入方式。

## 验证与卸载

`npm test` 使用独立的临时文件和回环模拟服务验证发现、PKCE、回调绑定、重连和导入的冲突边界，不访问个人 Codex 配置或真实账号。`npm pack --dry-run` 检查分发内容。真实验收：对一个允许测试的 OAuth 服务登录一次，确认原行显示「已连接」并能列出预期工具；不要用「回调成功」代替这个检查。

关闭插件即移除新设置页及回调。主动导入的服务和绑定的凭据不会随插件删除；需要回滚时先在原生 MCP 设置中停用或移除服务、移除请求头引用，再清理不再使用的 DSH 凭据（`DSH_MCP_*`）。远端授权在服务方撤销。
