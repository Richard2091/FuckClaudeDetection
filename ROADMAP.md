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