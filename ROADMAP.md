# ROADMAP

## 已完成

- [x] 浏览器扩展 v2.4.0：时区、语言、字体、WebRTC、Intl、请求语言等环境属性调整 + 可选 UA 平台增强 + 代理时区检测 + Popup UI
- [x] 图标与设计源文件落地（[logo/](logo/) 目录）
- [x] 系统级脚本（可选路线，仅限 Windows）：[scripts/claude-env.ps1](scripts/claude-env.ps1)

当前扩展的能力范围、覆盖矩阵与已知限制统一以 [extension/README.md](extension/README.md) 为准。

## 规划中：Claude Code CLI 环境一致性工具（cli/）

本目录为 Claude Code CLI 的本地环境一致性工具预留空间，尚未实现。

背景：相关公开资料（[JUNSHENG428/ai-coding-anti-ban](https://github.com/JUNSHENG428/ai-coding-anti-ban)）提到 Claude Code CLI 会读取时区与代理相关环境变量。本节仅为本地运行环境配置规划。

设计方向：

1. **Wrapper 启动器**：读取 TZ、代理与 `ANTHROPIC_BASE_URL` 配置，并按用户预定义策略校验配置是否符合目标档案
2. **Node Intl hook（进阶）**：通过 `node --require` 注入模块，调整 `Intl.DateTimeFormat` 与 `Date` 的时区相关行为
3. **共享配置**：与 extension 使用同一套时区/区域目标档案（该能力尚未实现）

## 规划中：Claude Desktop 环境一致性工具（desktop/）

本目录为 Claude Desktop（Electron 桌面应用）的本地环境配置工具预留空间，尚未实现。

设计方向：

1. **启动参数**：Electron 支持的 Chromium 开关（如 `--lang`）
2. **环境变量注入**：启动前设置 TZ 与代理变量
3. **时区伪装层可行性评估**
4. **共享配置**：规划中由 extension、CLI 与 desktop 共享同一套时区/区域目标档案（该能力尚未实现）


## 延后实施：Date 本地时区链路

当前已覆盖 `getTimezoneOffset()`（按时间戳动态计算，含夏令时）与 `toString` / `toTimeString` / `toLocale*` 的时区标注，但 `Date.prototype` 的本地时间 getter（`getHours` / `getDate` / `getDay` / `getMonth` / `getFullYear` / `getMinutes` / `getSeconds` / `toDateString`）仍返回宿主时区值。未来检测可交叉比对本地字段与 Intl 格式化时间发现不一致。

延后原因：

- 本地字段按目标时区重写涉及月/日跨边界换算与 `setHours` 等 setter 的对称语义，实现复杂度高
- 覆盖后页面可见时间将变为目标时区，属于用户可感知的行为变化
- 当前公开检测器不读取本地字段，仅作未来一致性校验防御

实现时建议拆阶段：先补 `getTimezoneOffset` 的按时间戳计算（已完成）与关键本地 getter，不一次性替换完整 `Date`。
## 非目标

本项目只处理浏览器或应用环境中的可配置属性。以下内容不在处理范围内：

- 账号信誉、支付方式、账号历史等账号层因素
- 网络出口信誉与 IP 地理（需由代理解决）
- TLS / HTTP2 指纹
- 渲染层像素指纹、WebGL、AudioContext 等深层指纹（当前未覆盖，见 extension/README 已知限制）