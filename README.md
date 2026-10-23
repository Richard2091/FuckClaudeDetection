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
| UA-CH 补全 | UA 平台开启时补全 Sec-CH-UA-Mobile / Platform-Version / Full-Version-List（版本随当前浏览器动态） |
| Intl 扩展 | Intl.Locale 与 Intl.DurationFormat 构造器 locale 注入 |
| UA 平台（增强，默认关） | JS 层根据当前浏览器 UA 推导 macOS UA/UA-CH；网络层通过 DNR 同步关键请求头。网络层实现存在版本基准限制 |

**总开关**：一键全开/全关，与子开关实时联动（任一子项开启即视为非全关）。

**代理时区检测**：自动查询代理出口 IP 的时区并匹配目标档案，避免代理地区与时区配置不一致；对中国大陆/港澳时区提供分级风险提示。

配置存储于浏览器本地，并通过 content bridge 注入页面环境。

## 安装

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择 `extension/` 目录
3. 点开插件栏盾牌图标使用

> 需要支持 Manifest V3、declarativeNetRequest 和 MAIN world content scripts 的 Chromium 浏览器（清单声明最低 Chrome 111）。安装时浏览器会提示"读取和更改您在所有网站上的数据"——用于页面环境注入与请求头改写，详见[权限说明](#权限说明)。

## 权限说明

| 权限 / 声明 | 用途 |
|-----------|------|
| `storage` | 配置持久化（chrome.storage.local） |
| `declarativeNetRequest` + `<all_urls>` | 改写 Accept-Language / 可选 UA 与 Sec-CH-UA 请求头 |
| content scripts（MAIN world，所有站点） | 页面环境注入 |
| `https://ipwho.is/` | 代理时区检测的外部查询目标 |

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