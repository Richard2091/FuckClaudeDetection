<div align="center">
  <img src="extension/icons/icon128.png" width="128" alt="Fuck Claude Detection">
  <h1>Fuck Claude Detection</h1>
  <p>浏览器环境属性本地伪装扩展 · Chrome MV3</p>
</div>

---

## 简介

一个浏览器环境防护扩展：在页面主环境中本地调整时区、语言、字体探测、WebRTC、Intl 区域和 UA 相关环境属性，使网页读到的环境与配置的目标档案一致。

所有伪装在浏览器内生效，不修改操作系统设置；配置通过 chrome.storage 持久化并热更新，无需刷新页面。

## 功能

| 开关 | 作用 |
|------|------|
| 时区伪装 | Intl.DateTimeFormat 注入目标时区；resolvedOptions 强制返回；getTimezoneOffset 按每个 Date 时间戳动态计算（正确处理夏令时） |
| 浏览器语言 | navigator.languages/language 返回冻结副本 |
| 中文字体拦截 | Canvas measureText 剔除 55 项字体名单（大小写无关、空列表回退中性字体）+ document.fonts.check 拦截 |
| WebRTC 拦截 | 独立原型链防逃逸 + iceServers 清空 + ICE 候选拦截 + getConfiguration 一致化 |
| Intl 区域 | 对常用 Intl 构造器注入目标 locale，使格式化行为与报告值一致 |
| 请求语言伪装 | DNR 改写 Accept-Language 请求头 |
| UA 平台伪装（增强，默认关） | JS 层根据当前浏览器 UA 推导 macOS UA/UA-CH；网络层通过 DNR 同步关键请求头。网络层实现存在版本基准限制 |

**总开关**：一键全开/全关，与子开关实时联动（任一子项开启即视为非全关）。

**代理时区检测**：自动查询代理出口 IP 的时区并匹配目标档案，避免代理地区与时区配置不一致；对中国大陆/港澳时区提供分级风险提示。

配置存储于浏览器本地，并通过 content bridge 注入页面环境。

## 安装

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择 `extension/` 目录
3. 点开插件栏盾牌图标使用

> 需要支持 Manifest V3、declarativeNetRequest 和 MAIN world content scripts 的 Chromium 浏览器（清单声明最低 Chrome 111）。安装时浏览器会提示"读取和更改您在所有网站上的数据"——用于页面环境注入与请求头改写，详见[权限说明](#权限说明)。

## 覆盖矩阵

覆盖类型：**✅ 默认覆盖**（开关开启即生效）/ **⚠ 条件或部分覆盖**（结果取决于运行平台）/ **⚙ 增强后覆盖**（需开启 UA 平台伪装）/ **— 原生无风险**（普通桌面 Chrome 环境无匹配）。"— / ⚙"表示普通桌面 Chrome 原生环境无匹配，非原生环境需启用 UA 平台伪装。

| 信号 | 权重 | 扩展对策 | 覆盖 |
|------|-----:|---------|:---:|
| 时区 | 24 | Intl.DateTimeFormat 构造器注入 timeZone；resolvedOptions 强制返回 | ✅ |
| 语言 | 18 | navigator.languages/language 冻结副本 `['en-US', 'en']` | ✅ |
| 字体 | 14 | measureText 剔除 + document.fonts.check 拦截（55 项名单，大小写无关） | ✅ |
| 厂商字体 | 10 | 同上通道覆盖全部厂商字体名单 | ✅ |
| WebRTC | 10 | 独立原型链 + iceServers 清空 + 候选拦截 + getConfiguration 一致化 | ✅ |
| 浏览器标识 | 8 | 原生 Chrome 无匹配；非原生 UA 环境需启用 UA 平台伪装 | — / ⚙ |
| 设备品牌 | 6 | 原生桌面 Chrome 无匹配；需启用 UA 平台伪装 | — / ⚙ |
| Intl 区域 | 4 | Intl 构造器注入目标 locale；resolvedOptions 强制返回 | ✅ |
| 时区偏移 | 3 | 按目标时区对每个时间戳动态计算（非 UTC+8 即 0 分） | ✅ |
| Emoji 风格 | 3 | 取决于平台：Windows 0.4 / Apple 0.25 / Linux 0.5；UA 平台伪装可归为 Apple | ⚠ |

## 验证数据

| 口径 | 结果 |
|------|-----:|
| 检测器客户端完整扫描 | **1 / 100** |
| 检测器服务端接口 | **约 2 / 100** |

- 取整规则：检测器对每项贡献先 `Math.round(score × weight)` 再累加
- Emoji 各平台显示分：Windows 0.4×3=1.2 → **1**；Apple 0.25×3=0.75 → **1**；Linux 0.5×3=1.5 → **2**
- 测试环境：Chrome 桌面版（构建号未记录）+ Windows + 美国代理出口；检测器版本 commit `bb00158`

## 权限说明

| 权限 / 声明 | 用途 |
|-----------|------|
| `storage` | 配置持久化（chrome.storage.local） |
| `declarativeNetRequest` + `<all_urls>` | 改写 Accept-Language / 可选 UA 与 Sec-CH-UA 请求头 |
| content scripts（MAIN world，所有站点） | 页面环境注入 |
| `https://ipwho.is/` | 代理时区检测的外部查询目标 |

## 已知限制

- **页面主环境注入方式不覆盖 Worker**：Dedicated / Shared / Service Worker 属于独立执行环境，当前检测器未使用该路径
- **UA 平台伪装仅改变可观察的平台标识与 UA-CH 字段**，不改变渲染特征、平台 API、硬件指纹；网络层 Sec-CH-UA 头存在固定版本基准
- **MAIN world hook 暴露在页面环境中**：页面理论上可通过原型链、函数属性或 toString 观察修改痕迹
- **字体拦截作用于查询通道**：真实文本渲染仍使用系统中文字体；Canvas 像素哈希、DOM 实测宽度等渲染级检测不在覆盖范围
- **IP 地理信号由出口 IP 决定**：必须依靠目标地区代理，扩展无法改写

## 隐私

- 扩展配置保存在 chrome.storage.local；检测结果仅在本地 Popup 与页面之间交换，不上传
- 代理时区检测会向 [ipwho.is](https://ipwho.is/) 发起 HTTPS 请求；该请求包含普通网络请求元数据，响应包含出口 IP 的地理与时区信息
- WebRTC 拦截关闭且打开面板自查时，会向默认 STUN 服务器发起探测（用于本地判断候选地址泄漏）；拦截开启时不产生该请求

## 文档

- [ROADMAP.md](ROADMAP.md) — 路线图（CLI / Desktop 环境一致性工具预留）与非目标
- [logo/](logo/) — 图标组件与 SVG 源文件
- [LICENSE](LICENSE) — MIT License
- 问题反馈请使用 [GitHub Issues](https://github.com/Richard2091/FuckClaudeDetection/issues)

## 致谢

- [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) — 公开指纹检测器实现；本项目覆盖矩阵参照其检测信号模型与 signals.ts 设计
- [JUNSHENG428/ai-coding-anti-ban](https://github.com/JUNSHENG428/ai-coding-anti-ban) — 检测机制逆向情报（时区/域名黑名单/关键词三层机制、设备指纹维度）
- [TZZ520/claude-environment-check](https://github.com/TZZ520/claude-environment-check) — 区域暴露诊断的网络层维度（出口路由/TLS/WebSocket/DNS）参考
- [lobehub/icons](https://github.com/lobehub/lobe-icons) — 白色 Claude 星芒图形路径参考，本项目调整了颜色与尺寸
- [ipwho.is](https://ipwho.is/) — 免费的 IP 地理与时区查询服务

## 免责声明

仅供学习研究与隐私防护用途。环境伪装仅作用于浏览器可观察属性；网络出口、系统级指纹、渲染指纹和账号层因素不在本项目能力范围内，使用本工具也不代表账号不会被风控。Claude 名称与相关商标归 Anthropic 所有；本项目与其无隶属关系。请遵守所在服务的条款与当地法律法规。