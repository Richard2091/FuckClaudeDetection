# PROPOSAL: Fingerprint Guard 指纹守卫 — 通用仓库规划

> 状态：规划文档（未实施）
> 目标：新建通用仓库 `FingerprintGuard`（干净起步，不含任何 Claude 品牌）
> 定位：**通用浏览器指纹守卫**——多地区预设 + 自定义伪装；Claude 场景恰好由"美国预设"覆盖，但产品与文档不出现 Claude 字样
> 来源说明：本提案由 Claude 风控专用扩展（本仓库）的设计经验演进而来，仅作为设计背景

---

## 1. 产品定位

**Fingerprint Guard 指纹守卫**：通用浏览器指纹伪装扩展。

- 能力：时区 / 语言 / 字体 / WebRTC / Intl / UA 平台等指纹的本地伪装
- 形态：多地区**场景预设** + 完全自定义
- 原则：引擎与预设分离——引擎只读 state，场景只是一组配置值

默认预设为**美国**（时区 America/New_York、locale en-US、语言 en-US, en）——这也天然兼容从 Claude 风控场景迁移过来的用户，无需特别区分。

---

## 2. 仓库策略

| 方案 | 评估 | 结论 |
| --- | --- | --- |
| 双仓库（通用 + Claude） | 核心 hook 代码 100% 重复，修复需双向同步 | 排除 |
| 单仓库双分支 | 分支适合短期特性，不适合长期产品变体 | 排除 |
| **新仓库 + 预设架构** | 引擎共享（从本仓库复制演进），场景=配置；干净无历史包袱 | ✅ 采用 |
| 双扩展构建目标 | 仅当需要分开上架商店时才有意义 | 备选 |

与现有仓库的关系：
- 现有 `FuckClaudeDetection` 保留为 Claude 专项版（独立维护或冻结）
- 新仓库 `FingerprintGuard` **复制引擎代码后干净起步**，git 历史是否保留可选（建议干净起步，README 说明设计渊源）
- 新仓库内不出现 Claude 字样：预设名、UI 文案、README 均用地区命名

---

## 3. 配置 Schema

```jsonc
{
  "preset": "us",                // us | jp | kr | de | fr | uk | sg | tw | custom
  "timezone": "America/New_York",
  "locale": "en-US",
  "langs": ["en-US", "en"],
  "features": {
    "timezone": true,
    "language": true,
    "fonts": true,
    "webrtc": true,
    "intlLocale": true,
    "uaPlatform": false,          // 增强项，默认关
    "acceptLanguageHeader": true
  }
}
```

- 选择内置预设 → 自动填充 timezone / locale / langs（三项在 UI 中只读）
- 切换为 `custom` → 三项解锁为可编辑
- `features` 各开关始终独立可操作

---

## 4. 内置预设定义表

| 预设 ID | 显示名 | timezone | locale | langs | 备注 |
| --- | --- | --- | --- | --- | --- |
| `us` | 美国（默认） | America/New_York | en-US | en-US, en | 最常用目标地区 |
| `jp` | 日本 | Asia/Tokyo | ja-JP | ja-JP, ja | |
| `kr` | 韩国 | Asia/Seoul | ko-KR | ko-KR, ko | |
| `de` | 德国 | Europe/Berlin | de-DE | de-DE, de | |
| `fr` | 法国 | Europe/Paris | fr-FR | fr-FR, fr | |
| `uk` | 英国 | Europe/London | en-GB | en-GB, en | |
| `sg` | 新加坡 | Asia/Singapore | en-SG | en-SG, en | 东南亚英语区 |
| `tw` | 台湾 | Asia/Taipei | zh-TW | zh-TW, zh | 同文同语区的低风险选项 |
| `custom` | 自定义 | 用户配置 | 用户配置 | 用户配置 | 解锁全部输入项 |

> 预设的价值是**一致性**：时区 / 语言 / locale 与合理 IP 地区互相匹配的已验证档案。后续可按需扩充（加拿大、澳大利亚、荷兰、瑞典等）。

---

## 5. 一致性提示（自定义模式）

自定义模式下校验"时区 ↔ 语言"匹配度，不匹配时黄字提醒（不阻止保存）：

| 时区区域 | 建议主语言 | 示例提示 |
| --- | --- | --- |
| Asia/Tokyo | ja | ⚠ 东京时区通常搭配 ja-JP，当前 en-US 可能形成矛盾指纹 |
| Europe/Berlin | de | ⚠ 柏林时区通常搭配 de-DE |
| Europe/London | en-GB | ✓ 匹配 |
| America/* | en-US / pt-BR 等 | ✓ 常见组合 |
| Asia/Shanghai | zh-CN | ⛔ 高风险地区，建议更换预设 |

数据来源：`timezone → country → 官方语言` 映射表（内置常用约 60 组）。

---

## 6. UI 设计草图

```
┌──────────────────────────────────────────┐
│ 🛡 Fingerprint Guard 指纹守卫     [总开关] │
├──────────────────────────────────────────┤
│ 场景预设   [ 美国 ▼ ]                     │
├──────────────────────────────────────────┤
│ 代理时区                                  │
│  时区 [ America/New_York        ▼ ] [⟳]  │  ← 内置预设只读；custom 时可搜索下拉
├──────────────────────────────────────────┤
│ 伪装功能                                  │
│  时区伪装            [开关]               │
│    America/New_York                      │
│  浏览器语言          [开关]               │
│    en-US, en                             │
│  中文字体拦截        [开关]               │
│    拦截中 · 名单全屏蔽                    │
│  WebRTC 拦截         [开关]               │
│  Intl 区域           [开关]               │
│  请求语言伪装        [开关]               │
│  UA 平台伪装（增强）  [开关]               │
└──────────────────────────────────────────┘
```

时区选择器实现建议：
- 常用时区分组（美洲 / 欧洲 / 亚太 / 非洲）+ 搜索输入（IANA 全量约 400 项）
- 内置预设模式下只读；custom 模式下可搜索选择

---

## 7. UI 主题

延续本仓库已验证的深色主题（暖灰面板 + Claude 橙点缀色），通用版主色建议调整：

| 元素 | 建议色 | 说明 |
| --- | --- | --- |
| 主色 / 开关开启态 | `#4CAF50` 绿 或保留橙 | 绿 = "防护"语义，橙 = 延续现有视觉；二选一 |
| 页面背景 | `#101623` 系（沿用） | 深色主题不变 |

---

## 8. 实施步骤清单（新仓库）

| 步骤 | 内容 | 涉及文件 | 规模 |
| --- | --- | --- | --- |
| 1 | 新建仓库 `FingerprintGuard`（含 LICENSE、README、.gitignore） | 仓库初始化 | 小 |
| 2 | 从本仓库 `extension/` 复制引擎代码（manifest/content/content-bridge/rules/popup） | 全部扩展文件 | 小 |
| 3 | 去品牌化清理：manifest 名称/描述、popup 标题与副标题、README 全部重写 | manifest.json、popup、README | 小 |
| 4 | 配置 schema 加 `preset` 字段 + `presets.js` 预设定义表（美国默认） | popup/presets.js（新增）、popup.js | 小 |
| 5 | popup 加"场景预设"下拉与联动逻辑 | popup.html、popup.js | 中 |
| 6 | 时区选择器（分组 + 搜索） | popup.html、popup.css、popup.js | 中 |
| 7 | 自定义模式解锁三项编辑 + 一致性提示 | popup.js、popup.css | 中 |
| 8 | GitHub 仓库信息维护：description、topics、social preview 图标 | gh CLI | 小 |

---

## 9. 与现有 Claude 专项版的关系

| 仓库 | 定位 | 维护策略 |
| --- | --- | --- |
| `FuckClaudeDetection`（本仓库） | Claude 风控专项版（当前默认值即美国档案） | 继续维护 / 或冻结为稳定版 |
| `FingerprintGuard`（新仓库） | 通用版，美国为默认预设 | 主力演进 |

两版引擎代码同源，安全修复建议同步。用户从 Claude 专项版切换到通用版：默认值相同（美国档案），体验无缝。