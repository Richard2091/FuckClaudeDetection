<div align="center">
  <img src="extension/icons/icon128.png" width="128" alt="Fuck Claude Detection">
  <h1>Fuck Claude Detection</h1>
  <p><b>统一指纹守卫</b> · 真实修改浏览器环境 · 降低 Claude 区域风控风险分</p>
  <p>Chrome MV3 · 纯扩展实现 · 不改动本机设置 · 配置热更新</p>
</div>

---

## 这是什么

一个浏览器指纹防护扩展：在页面内**真实接管**时区、语言、字体、WebRTC、Intl 区域等浏览器环境 API，使网页（包括 Claude 区域风控检测器）读到的环境与你配置的目标档案一致——而不是仅针对某个检测站做表面应答。

- 目标档案默认：`America/New_York` + `en-US`，支持**一键检测代理出口时区**自动匹配
- 针对社区公开的 Claude 区域风控逻辑（时区/语言/字体等 10 项加权信号）实现了全量覆盖
- 所有伪装在浏览器内生效，不修改系统设置；配置热更新，无需刷新页面

## 预期效果

| 口径 | 分数 |
|------|-----:|
| fuck-claude 检测站 · 客户端完整扫描 | **1 / 100** |
| fuck-claude 检测站 · 服务端 /api/check | 约 2 / 100 |

> 检测站对每项贡献逐项取整（emoji Windows 0.4×3=1.2 → 显示 1），因此单靠扩展无法得到 0 分；IP 地理信号由出口 IP 决定，需配合目标地区代理。

## 功能开关

| 开关 | 作用 |
|------|------|
| 时区伪装 | Intl.DateTimeFormat 注入目标时区；resolvedOptions 强制返回；getTimezoneOffset 按时间戳动态计算（正确处理夏令时） |
| 浏览器语言 | navigator.languages/language 冻结副本 + DNR 改写 Accept-Language 请求头 |
| 中文字体拦截 | Canvas measureText 剔除 55 项字体名单（大小写无关、空列表回退中性字体）+ document.fonts.check 拦截 |
| WebRTC 拦截 | 独立原型链防逃逸 + iceServers 清空 + ICE 候选拦截 + getConfiguration 一致化 |
| Intl 区域 | Intl 各构造器**真实 locale 注入**（格式化行为与报告值一致） |
| 请求语言伪装 | Accept-Language 请求头（与浏览器语言开关联动） |
| UA 平台伪装（增强，默认关） | navigator.platform/UA/vendor/UA-CH 高熵值 JS hook + 网络层 Sec-CH-UA 头同步；UA 版本从真实 UA 动态推导 |

**总开关**：一键全开/全关，与子开关实时联动。**代理时区检测**：自动匹配代理出口，含港澳/大陆时区分级风险提示。

## 工作原理

```
popup ──chrome.storage──▶ content-bridge（ISOLATED）──postMessage──▶ content.js（MAIN world hooks）
```

- MAIN world hook 直接替换页面可见的浏览器 API，页面 JS 读到的就是伪装后的环境
- DNR 同时改写请求头（Accept-Language / 可选 UA / Sec-CH-UA），保证网络层一致
- 配置推送带一次性 nonce 防重放

## 覆盖矩阵

见 [extension/README.md](extension/README.md)（对照 [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) 检测源码逐项验证）。

## 已知边界

诚实声明当前架构的能力范围：Web Worker 独立环境、渲染层像素指纹、IP 地理信号（需代理）、TLS/HTTP2 指纹、hook 可观察性。详见 [ROADMAP.md 已知边界](ROADMAP.md)。

## 构建

无需构建依赖，直接以未打包扩展加载 `extension/` 目录。

打包分发（示例）：

```powershell
# zip（Chrome/Edge 通用）
Compress-Archive -Path extension\* -Destination FuckClaudeDetection-chrome-mv3.zip

# crx（需本机 Chrome 私钥）
chrome.exe --pack-extension=.\extension --pack-extension-key=.\key.pem
```

## 隐私

- 所有伪装在浏览器本地生效，不修改系统设置
- 唯一外部请求：代理时区检测访问 `ipwho.is` 查询出口 IP 地理（可不开代理时区功能避免）
- 检测站扫描结果零上传

## 路线图

见 [ROADMAP.md](ROADMAP.md)：Claude Code CLI / Desktop 伪装预留、Worker 注入、渲染层一致性等。

## 致谢

本项目的检测覆盖设计参考并吸收了以下开源项目的思路与情报，感谢这些作者的贡献：

- [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) — Claude 区域风控检测器的完整实现，本扩展的覆盖矩阵以其 `signals.ts` 检测源码为基准逐项验证
- [JUNSHENG428/ai-coding-anti-ban](https://github.com/JUNSHENG428/ai-coding-anti-ban) — Claude Code 三层检测机制（时区/域名黑名单/关键词）与设备指纹维度的深度逆向情报，为 CLI/Desktop 伪装路线提供了关键参考
- [TZZ520/claude-environment-check](https://github.com/TZZ520/claude-environment-check) — Claude 区域暴露诊断的网络层维度（出口路由/TLS/WebSocket/DNS）参考
- [lobehub/icons](https://github.com/lobehub/lobe-icons) — Claude 星芒图标参考
- [ipwho.is](https://ipwho.is/) — 免费的 IP 地理与时区查询服务
- E-terra-spark 图标设计稿（社区贡献）

## 免责声明

仅供学习研究与隐私防护用途。使用本工具不代表账号不会被风控——IP 信誉、付款方式、账号历史是 Claude 真正的风控维度。请遵守所在服务的条款与当地法律法规。