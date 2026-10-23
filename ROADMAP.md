# ROADMAP

## 已完成

- [x] 浏览器扩展 v2.1：时区/语言/字体/WebRTC/Intl 六项伪装 + 代理时区检测 + Popup UI
- [x] 系统级脚本（可选路线）：claude-env.ps1 一键切换

## 进行中

- [ ] Claude 星芒 Logo 已作为扩展图标落地（logo/ 目录含设计源码）

## 规划中：Claude Code CLI 伪装（cli/）

背景：据公开逆向报告，Claude Code CLI 读取操作系统时区（`Intl.DateTimeFormat().resolvedOptions().timeZone`）和 `ANTHROPIC_BASE_URL` 中转域名，并把判定结果隐写进 system prompt 的"Today's date"行。

设计方向（未实现，仅预留）：

1. **Wrapper 启动器**：`fc-cli.cmd` / PowerShell 包装脚本
   - 启动前设置 `TZ=America/New_York`（Node.js 在 Windows 上读取 TZ 环境变量）
   - 设置 `HTTPS_PROXY` / `HTTP_PROXY` 指向代理
   - 校验 `ANTHROPIC_BASE_URL` 域名中性（不含 flagged 关键词）
2. **Node Intl hook**（深入路线）：`node --require ./tz-patch.js` 注入模块，重写 `Intl.DateTimeFormat.prototype.resolvedOptions` 与 `Date.prototype.getTimezoneOffset`
3. **配置文件**：`cli/config.json` 与扩展共享目标时区，保持一致性
4. **验收**：CLI 内执行 `Intl.DateTimeFormat().resolvedOptions().timeZone` 输出目标时区

## 规划中：Claude Code Desktop 伪装（desktop/）

背景：Claude Desktop 是 Electron 应用，读取系统时区/区域，且内置 WebView 与系统共享网络栈。

设计方向（未实现，仅预留）：

1. **启动参数**：Electron 支持的 Chromium 开关（`--lang=en-US` 等）
2. **环境变量注入**：启动前设置 TZ / 代理变量
3. **时区欺骗层**（深入路线）：Windows 局部时区伪装复杂，需评估 SetDynamicTimeZone 权限影响；或使用 Windows 沙箱/容器隔离运行
4. **与扩展共享配置**：读取 `extension` 的 config 时区值，保持三端一致

## 原则

- 所有伪装手段保持**可逆**且**用户可感知**（UI 开关）
- 不触碰账号安全红线：IP 信誉、付款方式、账号历史是 Claude 真正的风控维度，本工具箱只处理"环境指纹"层
## 已知边界（交叉审核确认）

以下边界经双代理交叉审核确认，属当前架构的能力范围之外，暂不整改：

1. **IP 地理信号**（x-vercel-ip-timezone / x-vercel-ip-country）：由出口 IP 决定，DNR 无法可靠改写，必须依靠目标地区代理
2. **Web Worker / Shared Worker / Service Worker**：独立 JS realm，content script 无法注入（当前检测站未使用，未来对抗面）
3. **渲染层指纹**：拦截的是 measureText 探测层，真实文本渲染仍使用系统中文字体；像素哈希 / document.fonts.check / FontFace 未覆盖
4. **MAIN world hook 可观察性**：hook 天然暴露在页面环境中（页面可检测 toString / 原型链），无法绝对不可检测
5. **TLS / HTTP2 指纹**：需代理层解决
6. **仅改 UA 不等于完整 macOS 环境**：真实平台伪装还牵涉渲染特征、平台 API 与硬件指纹
7. **服务端评分口径**：/api/check 仅测 62 权重信号并归一化（干净 Windows + 美国代理约 2/100）；港澳时区在服务端的显示影响大于客户端的 14 分直观值