<div align="center">
  <img src="extension/icons/icon128.png" width="128" alt="Fingerprint Guard">
  <h1>统一指纹守卫 <sub>（Fingerprint Guard）</sub></h1>
  <p>浏览器环境属性本地伪装扩展 · Chrome MV3 · 仓库代号 <code>FuckClaudeDetection</code></p>
</div>

---

## 简介

一个浏览器环境防护扩展：在页面主环境中本地调整时区、语言、字体探测、WebRTC、Intl 区域和 UA 相关环境属性，使网页读到的环境与配置的目标档案一致。

所有伪装在浏览器内生效，不修改操作系统设置；配置通过 chrome.storage 持久化并热更新，无需刷新页面。

项目的覆盖验证曾参照一个公开指纹检测器（[LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude)）的信号模型，具体覆盖程度见 [覆盖矩阵](extension/README.md#覆盖矩阵)。

## 功能

| 开关 | 作用 |
|------|------|
| 时区伪装 | Intl.DateTimeFormat 注入目标时区；resolvedOptions 强制返回；getTimezoneOffset 按每个 Date 时间戳动态计算（正确处理夏令时） |
| 语言伪装 | navigator.languages/language 返回冻结副本；DNR 改写 Accept-Language 请求头 |
| 中文字体拦截 | Canvas measureText 剔除 55 项字体名单（大小写无关、空列表回退中性字体）+ document.fonts.check 拦截 |
| WebRTC 拦截 | 独立原型链防逃逸 + iceServers 清空 + ICE 候选拦截 + getConfiguration 一致化 |
| Intl 区域 | 对常用 Intl 构造器注入目标 locale，使格式化行为与报告值一致 |
| UA 平台伪装（增强，默认关） | JS 层根据当前浏览器 UA 推导 macOS UA/UA-CH；网络层通过 DNR 同步关键请求头。网络层实现存在版本基准限制，详见[技术文档](extension/README.md) |

**总开关**：一键全开/全关，与子开关实时联动（任一子项开启即视为非全关）。

**代理时区检测**：自动查询代理出口 IP 的时区并匹配目标档案，避免代理地区与时区配置不一致；对中国大陆/港澳时区提供分级风险提示。

配置存储于浏览器本地，并通过 content bridge 注入页面环境；详细架构与验证数据见 [extension/README.md](extension/README.md)。

## 安装

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择 `extension/` 目录
3. 点开插件栏盾牌图标使用

需要支持 Manifest V3、declarativeNetRequest 和 MAIN world content scripts 的 Chromium 浏览器（清单声明最低 Chrome 111）。安装时浏览器会提示"读取和更改您在所有网站上的数据"——用于页面环境注入与请求头改写，详见[权限说明](extension/README.md#权限说明)。

## 文档

- [extension/README.md](extension/README.md) — 技术架构、覆盖矩阵、验证数据、权限与隐私说明
- [ROADMAP.md](ROADMAP.md) — 路线图（CLI / Desktop 环境一致性工具预留）与非目标
- [logo/](logo/) — 图标组件与 SVG 源文件（盾形轮廓由本项目绘制；白色 Claude 星芒路径参考 [lobehub/icons](https://github.com/lobehub/lobe-icons) 的 Claude 图标）
- [LICENSE](LICENSE) — MIT License
- 问题反馈请使用 [GitHub Issues](https://github.com/Richard2091/FuckClaudeDetection/issues)

## 第三方声明

- 白色 Claude 星芒路径参考自 [lobehub/icons](https://github.com/lobehub/lobe-icons) 的 Claude 图标（本项目中按需调整了颜色与尺寸）
- Claude 名称与相关商标归 Anthropic 所有；本项目与其无隶属关系

## 致谢

- [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) — 公开指纹检测器实现；本项目覆盖矩阵参照其检测信号模型与 signals.ts 设计
- [JUNSHENG428/ai-coding-anti-ban](https://github.com/JUNSHENG428/ai-coding-anti-ban) — Claude Code 检测机制逆向情报（时区/域名黑名单/关键词三层机制、设备指纹维度）
- [TZZ520/claude-environment-check](https://github.com/TZZ520/claude-environment-check) — 区域暴露诊断的网络层维度（出口路由/TLS/WebSocket/DNS）参考
- [lobehub/icons](https://github.com/lobehub/lobe-icons) — Claude 星芒图标路径来源
- [ipwho.is](https://ipwho.is/) — 免费的 IP 地理与时区查询服务
- 盾形轮廓与整体构图由作者设计

## 免责声明

仅供学习研究与隐私防护用途。环境伪装仅作用于浏览器可观察属性；网络出口、系统级指纹、渲染指纹和账号层因素不在本项目能力范围内，使用本工具也不代表账号不会被风控。请遵守所在服务的条款与当地法律法规。