# desktop/ — Claude Desktop 环境一致性工具（规划占位）

本目录为 Claude Desktop（Electron 桌面应用）的本地环境配置工具预留目录，尚未实现。

设计方向见 [../ROADMAP.md](../ROADMAP.md)：

- 启动参数：Electron 支持的 Chromium 开关（如 `--lang`）
- 环境变量注入：启动前设置 TZ 与代理变量
- 时区伪装层可行性评估
- 共享配置：规划中由 extension、CLI 与 desktop 共享同一套时区/区域目标档案（该能力尚未实现）

实现落地前，本目录不应被理解为目标服务的绕过指南；规划仅涉及本地运行环境配置。