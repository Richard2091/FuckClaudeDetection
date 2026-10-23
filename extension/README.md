# 扩展技术说明（v2.4.0）

本扩展基于 [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude) 的公开检测信号模型进行验证，不修改操作系统设置。功能开关与使用说明见根 [README.md](../README.md#功能)，本节描述实现映射、覆盖矩阵与验证口径。

## 测试环境与方法

| 项目 | 值 |
|------|-----|
| 检测器 | [LinXiaoTao/FuckClaude](https://github.com/LinXiaoTao/FuckClaude)，commit `bb0015805a4a92a7ed9221693219a69315123aee` |
| 浏览器 | Chrome 桌面版（具体构建号未在验证时记录，方法可复现） |
| 操作系统 | Windows 10/11 |
| 网络出口 | 美国代理 |
| 扩展配置 | 目标档案 America/New_York + en-US；全部开关开启；UA 平台增强关闭 |
| 方法 | 检测器客户端完整扫描 + `/api/check` 服务端接口 |

## 验证数据

| 口径 | 结果 |
|------|-----:|
| 客户端完整扫描 | **1 / 100** |
| 服务端 `/api/check` | **约 2 / 100** |

取整规则：公开检测器对每项贡献先 `Math.round(score × weight)` 再累加（`detect.ts`）。

- emoji 信号：Windows 0.4×3=1.2 → 显示 **1**；Linux 0.5×3=1.5 → 显示 **2**；Apple 0.25×3=0.75 → 显示 **1**
- 服务端仅统计 62 权重信号并归一化

## 覆盖矩阵

覆盖类型：**✅ 默认覆盖**（开关开启即生效）/ **⚠ 条件或部分覆盖**（结果取决于运行平台、原生环境或增强开关）/ **⚙ 增强后覆盖**（需开启 UA 平台伪装）/ **— 原生无风险**（普通桌面 Chrome 环境无匹配）。"— / ⚙"表示普通桌面 Chrome 原生环境无匹配，非原生或目标环境需启用 UA 平台伪装。

| 信号 | 权重 | 检测 API | 扩展对策 | 覆盖 |
|------|-----:|---------|---------|:---:|
| timezone | 24 | `Intl.DateTimeFormat().resolvedOptions().timeZone` | 构造器注入 timeZone；resolvedOptions 强制返回 | ✅ |
| language | 18 | `navigator.languages` / `language`（scoreLanguages 判定） | getter 返回冻结副本 `['en-US', 'en']` | ✅ |
| fonts | 14 | Canvas `measureText` 探测 19 简体 + 8 繁体字体 | measureText 剔除 + document.fonts.check 拦截（55 项名单，大小写无关） | ✅ |
| vendorFonts | 10 | Canvas `measureText` 探测 16 项厂商字体 | 同上通道覆盖全部 16 项 | ✅ |
| webrtcLeak | 10 | RTCPeerConnection + STUN + onicecandidate 收集候选 | 独立原型链 + iceServers 清空 + 候选拦截 + getConfiguration 一致化 | ✅ |
| cnBrowser | 8 | UA + UA-CH brands 正则 | 原生 Chrome 无匹配；非原生 UA 环境需启用 UA 平台伪装 | — / ⚙ |
| deviceVendor | 6 | UA-CH `getHighEntropyValues(['model','platform','platformVersion'])` | 原生桌面 Chrome 无匹配；国产设备环境需启用 UA 平台伪装 | — / ⚙ |
| intlLocale | 4 | `resolvedOptions().locale` | Intl 构造器注入目标 locale；resolvedOptions 强制返回 | ✅ |
| timezoneOffset | 3 | `new Date().getTimezoneOffset() === -480` | 按目标时区对每个时间戳动态计算（非 -480 即 0 分） | ✅ |
| emoji | 3 | `navigator.platform` + `userAgent` 推断厂商 | Windows 0.4 / Apple 0.25 / Linux 0.5；UA 平台伪装可将平台归为 Apple：Windows 的 emoji 显示分保持 1；Linux 通常由 2 降至 1；Apple 保持 1 | ⚠ |

## 实现架构

```
popup ──chrome.storage──▶ content-bridge（ISOLATED）──postMessage──▶ content.js（MAIN world hooks）
```

- MAIN world hook 直接替换页面可见的浏览器 API；DNR 同步改写请求头（Accept-Language / 可选 UA 与 Sec-CH-UA 系列）
- 配置推送带一次性 nonce 防重放；DNR 动态规则随开关实时同步

## 权限说明

| 权限 / 声明 | 用途 |
|-----------|------|
| `storage` | 配置持久化（chrome.storage.local） |
| `declarativeNetRequest` + `<all_urls>` | 改写 Accept-Language / 可选 UA 与 Sec-CH-UA 请求头 |
| content scripts（MAIN world，所有站点） | 页面环境注入 |
| `https://ipwho.is/` | 代理时区检测的外部查询目标 |

## 已知限制

- **页面主环境注入方式不覆盖 Worker**：Dedicated / Shared / Service Worker 属于独立执行环境，当前公开检测器未使用该路径；后续可评估扩展支持范围
- **UA 平台伪装仅改变可观察的平台标识与 UA-CH 字段**，不改变渲染特征、平台 API、硬件指纹或完整系统行为；网络层 Sec-CH-UA 头存在固定的版本基准（当前 Chrome 131），可能与实际浏览器主版本存在差异
- **MAIN world hook 暴露在页面环境中**：页面理论上可通过原型链、函数属性或 toString 观察修改痕迹
- **字体拦截作用于查询通道**（measureText / document.fonts.check）：真实文本渲染仍使用系统中文字体；Canvas 像素哈希、DOM 实测宽度等渲染级检测不在当前覆盖范围

## 隐私说明

- 扩展配置保存在 chrome.storage.local；检测结果仅在本地 Popup 与页面之间交换，不上传
- 代理时区检测会向 [ipwho.is](https://ipwho.is/) 发起 HTTPS 请求；该请求包含普通网络请求元数据，响应包含出口 IP 的地理与时区信息
- WebRTC 拦截关闭且打开面板自查时，扩展会向默认 STUN 服务器发起探测（用于本地判断候选地址泄漏）；拦截开启时不产生该请求

## 第三方来源

- 白色 Claude 星芒图形路径参考自 [lobehub/icons](https://github.com/lobehub/lobe-icons) 的 Claude 图标，本项目调整了颜色与尺寸
- Claude 名称与相关商标归 Anthropic 所有；本项目与其无隶属关系