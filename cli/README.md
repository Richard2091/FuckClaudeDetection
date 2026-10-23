# cli/ — Claude Code CLI 环境一致性工具（规划占位）

本目录目前不包含可运行实现，仅保留未来设计空间。

设计方向见 [../ROADMAP.md](../ROADMAP.md#规划中claude-code-cli-环境一致性工具cli)：

- Wrapper 启动器（读取 TZ、代理与 `ANTHROPIC_BASE_URL` 配置，并按用户预定义策略校验）
- Node Intl hook（`node --require` 注入）
- 与 extension 共享时区/区域目标档案

实现落地前，本目录不应被理解为目标服务的绕过指南；规划仅涉及本地运行环境配置。