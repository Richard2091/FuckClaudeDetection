<div align="center">
  <img src="extension/icons/icon128.png" width="128" alt="Fuck Claude Detection">
  <h1>Fuck Claude Detection</h1>
  <p>统一指纹守卫 · 真实修改浏览器环境 · 降低 Claude 区域风控风险分</p>
</div>

---

针对 [fuck-claude.vercel.app](https://fuck-claude.vercel.app/) 检测的 Chrome 扩展（MV3）。**纯扩展实现，不改动本机任何设置**，经双代理交叉审核（覆盖矩阵 + 真实性评级）迭代。

## 预期分数

| 口径 | 分数 |
|------|------|
| 客户端完整扫描 | **1 / 100**（检测站逐项取整：emoji Windows 0.4×3=1.2 → 1） |
| 服务端 /api/check | **约 2 / 100**（仅测 62 权重信号并归一化） |

## 覆盖矩阵（对照 [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) 检测源码）

| 信号 | 权重 | 真实性实现 | 状态 |
|------|-----:|-----------|:---:|
| timezone | 24 | Intl.DateTimeFormat 构造器注入 timeZone，resolvedOptions 强制返回 | ✅ |
| language | 18 | navigator.languages/language hook（冻结副本）+ DNR 改写 Accept-Language 头 | ✅ |
| fonts | 14 | Canvas measureText 剔除，55 项名单，大小写无关，空列表回退中性字体 | ✅ |
| vendorFonts | 10 | 完整覆盖检测站 16 项厂商字体名单 | ✅ |
| webrtcLeak | 10 | 独立原型链防逃逸 + iceServers 清空 + ICE 候选拦截 + getConfiguration 一致 | ✅ |
| cnBrowser | 8 | 原生 Chrome 无匹配；UA 平台伪装（增强）覆盖中国浏览器 UA | ✅ |
| deviceVendor | 6 | UA-CH 高熵值（model/platform/platformVersion）同步伪装 | ✅ |
| intlLocale | 4 | Intl 各构造器**真实 locale 注入**（行为与报告一致，非仅伪造报告值） | ✅ |
| timezoneOffset | 3 | getTimezoneOffset **按每个 Date 时间戳动态计算**（正确处理夏令时） | ✅ |
| emoji | 3 | UA 平台伪装增强后 JS/网络层均为 Apple（0.25）；Windows 未开增强时 0.4 | ⚠ |

## 功能

- **代理时区自动检测**：自动匹配代理出口时区（避免代理在加拿大而配置在美国）；港澳/大陆时区分级风险提示
- **7 项独立开关**：时区伪装 / 浏览器语言 / 中文字体拦截 / WebRTC 拦截 / Intl 区域 / 请求语言伪装 / UA 平台伪装（增强，默认关）
- **总开关**：一键全开/全关，与子开关实时联动
- **实时参数面板**：每行显示页面内实际生效值
- **配置热更新**：修改即时生效，无需刷新页面；一次性 nonce 防重放

## 安装

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择 `extension/` 目录
3. 点开插件栏盾牌图标使用

## 已知边界（诚实声明）

- Web Worker / Service Worker 独立 JS 环境不在 content script 覆盖范围（当前检测站未使用）
- 拦截的是探测层（measureText），不改变真实文本渲染字体
- IP 地理信号（x-vercel-ip-timezone/country）由出口 IP 决定，必须依靠代理
- TLS / HTTP2 指纹需代理层解决
- MAIN world hook 天然可被页面检测（当前检测站不做此检查）

## 路线图

见 [ROADMAP.md](ROADMAP.md)（Claude Code CLI / Desktop 伪装预留）。

## 免责声明

仅供学习研究与隐私防护用途。使用本工具不代表账号不会被封禁——IP 信誉、付款方式、账号历史是 Claude 真正的风控维度。请遵守服务条款。