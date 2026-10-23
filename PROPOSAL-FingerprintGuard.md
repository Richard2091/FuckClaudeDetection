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
  "preset": "us",                // us | jp | kr | de | fr | uk | sg | tw | custom | custom-<id>
  "scope": "global",             // 作用域：global（全局）| tab（仅当前标签页）
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

另存于 storage 顶层（不随单份配置导出，见 §11 预设管理）：

```jsonc
{
  "customPresets": [              // 用户自定义预设（可添加/删除/导入/导出）
    { "id": "custom-1730000000000", "name": "我的预设", "timezone": "...", "locale": "...", "langs": ["..."] }
  ]
}
```

- 选择内置预设 → 自动填充 timezone / locale / langs（三项在 UI 中只读）
- 切换为 `custom` → 三项解锁为可编辑
- `features` 各开关始终独立可操作
- **自动切换 custom**：preset 非 custom 时，用户手动修改 timezone / locale / langs 任一项且与预设值不一致 → `preset` 自动变为 `custom`（下拉显示"自定义"）；将值改回与某预设一致时**不自动切回**（避免抖动），由用户在预设下拉手动选回
- 子开关（features）状态与预设**解耦**：切换 features 不触发 preset 变化

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
│  UA 平台（增强）  [开关]               │
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
| 9 | 作用域（全局/单标签）：动态注入 + DNR session rules（tabIds 条件）+ 切换撤销流程 | background.js、popup、content | 大 |
| 10 | 预设管理：添加/删除/导入/导出（customPresets 存储 + 管理面板） | popup/presets.js、popup.js、popup.html | 中 |
| 11 | 代理时区自动检测（⟳ 检测出口 IP 时区并自动应用，含 loading/扫光动效与冷却） | popup.js | 小 |
| 12 | 动效规范落地：下拉/面板展开收起过渡（见 §12） | popup.css | 小 |

---

## 9. 与现有 Claude 专项版的关系

| 仓库 | 定位 | 维护策略 |
| --- | --- | --- |
| `FuckClaudeDetection`（本仓库） | Claude 风控专项版（当前默认值即美国档案） | 继续维护 / 或冻结为稳定版 |
| `FingerprintGuard`（新仓库） | 通用版，美国为默认预设 | 主力演进 |

两版引擎代码同源，安全修复建议同步。用户从 Claude 专项版切换到通用版：默认值相同（美国档案），体验无缝。


---

## 10. 作用域（Scope）

伪装注入的作用范围，二选一：

| 作用域 | 含义 | 技术实现 | 适用场景 |
| --- | --- | --- | --- |
| **全局**（默认） | 所有标签页的所有页面均注入伪装 | manifest 静态 `content_scripts`（现有架构）+ DNR 静态规则改写 Accept-Language | 日常全浏览器使用 |
| **单标签** | 仅当前标签页生效，其他标签页不受影响 | `chrome.scripting.executeScript` 按需动态注入；用 `chrome.storage.session` 记录已注入 tabId 集合；Accept-Language 头改用 `declarativeNetRequest` **session rules** + `condition.tabIds`（仅命中指定标签页） | 临时验证伪装效果、不影响工作标签页 |

- 配置字段：`scope: "global" | "tab"`
- **切换行为**：
  - 全局 → 单标签：提示"其他标签页将在刷新后恢复真实环境"，当前标签页保持伪装并转为动态注入托管
  - 单标签 → 全局：清除 session rules 与动态注入状态，全站刷新后生效
- **UI**：伪装功能区顶部"作用域 `[ 全局 ▼ ]`"，展开两个选项各带一行说明（如上表"含义"列）
- **诚实标注的技术边界**：Web Worker 内的脚本无法注入（MV3 限制），单标签与全局模式均不覆盖 Worker 场景

## 11. 每项独立配置与预设管理

### 11.1 每项独立配置（自定义模式）

- `custom` 模式下 `timezone` / `locale` / `langs` 三项**完全解耦**，可任意组合（如东京时区 + en-US 语言），配合 §5 一致性提示给出黄字提醒
- `features` 子开关独立于预设值，随时可单独切换

### 11.2 预设管理（添加 / 删除 / 导入 / 导出）

| 操作 | 说明 | 约束 |
| --- | --- | --- |
| **添加** | 将当前 timezone/locale/langs（可选含 features）保存为新预设，弹窗命名 | 名称非空、去重 |
| **删除** | 删除自定义预设 | 内置 9 项锁定不可删；删除当前正在使用的预设时先切回 `us` |
| **导出** | 单个预设或全部自定义预设 → JSON 文件：`{ "version": 1, "exportedAt": "...", "presets": [...] }` | — |
| **导入** | 选择 JSON → schema 校验 → 重名策略三选一（覆盖 / 自动重命名 / 跳过） | 校验失败项逐条报告 |

- 存储：`chrome.storage.local` 的 `customPresets: Preset[]`
- UI：预设下拉分两组展示（**内置预设** / **我的预设**），下拉尾部固定入口"＋ 保存为预设"与"管理预设…"
- 管理面板：自定义预设列表（名称、时区摘要、导出/删除操作）+ 底部导入按钮

### 11.3 Schema 摘要

见 §3（`scope` 与 `customPresets` 已纳入）。

## 12. 动效规范

所有展开/收起类交互（时区选择器、作用域选择、预设管理面板）统一：

| 项 | 规范 |
| --- | --- |
| 展开 | `scale(0.96) → scale(1)` + `opacity(0 → 1)`，180ms `cubic-bezier(0.2, 0.8, 0.2, 1)`（ease-out） |
| 收起 | `scale(1) → scale(0.96)` + `opacity(1 → 0)`，140ms `ease-in` |
| transform-origin | 顶部左侧（与触发控件对齐） |
| 无障碍 | 尊重 `prefers-reduced-motion: reduce`：动画时长降为 0，直接切换 |
| 风格 | 与整体深色主题一致（面板色、边框色沿用 CSS 变量） |

## 13. 代理时区自动检测（自 Claude 版迁移）

- 入口：代理时区行右侧 ⟳ 图标（手动）+ 开启"时区伪装"或总开关全开时自动触发一次（60s 冷却）
- 逻辑：请求 `ipwho.is` 获取出口 IP 时区 → 自动应用为 `timezone` → 时区值播放从左至右扫光动效
- 状态反馈：检测中时区值脉冲 + 图标旋转；失败时值短暂变红（悬停显示原因），无弹窗
