# Fuck Claude Detection - 浏览器扩展 v3.0

纯扩展方式覆盖 fuck-claude.vercel.app 检测站 10 项信号，不改动本机任何设置。经双代理交叉审核整改（覆盖矩阵 + 真实性评级）。

## 预期分数

- **客户端扫描：1 / 100**（检测站对每项贡献逐项取整：emoji Windows 0.4×3=1.2 → 显示 1）
- **服务端 /api/check：约 2 / 100**（仅测 62 权重信号并归一化）
- 开启"UA 平台伪装"增强后，服务端口径可将 emoji 归为 Apple（0.25×3=0.75 → 显示 1，客户端显示分不变，但服务端 UA/UA-CH 一致性提升）

## 覆盖矩阵（对照检测站源码 signals.ts）

| 信号 | 权重 | 扩展对策 | 覆盖 |
|------|------|---------|------|
| timezone | 24 | Intl.DateTimeFormat 构造器注入 + resolvedOptions 强制 | ✅ |
| language | 18 | navigator.languages hook + DNR 改写 Accept-Language | ✅ |
| fonts | 14 | Canvas measureText 剔除（55 项名单，大小写无关） | ✅ |
| vendorFonts | 10 | 同上（完整覆盖检测站 16 项厂商字体） | ✅ |
| webrtcLeak | 10 | 独立原型链 + iceServers 清空 + 候选拦截 + getConfiguration 一致 | ✅ |
| cnBrowser | 8 | 原生 Chrome 无匹配；UA 平台伪装（增强）可覆盖中国浏览器 UA | ✅ |
| deviceVendor | 6 | 同上（UA-CH 高熵值同步伪装） | ✅ |
| intlLocale | 4 | Intl 构造器真实 locale 注入（行为与报告一致） | ✅ |
| timezoneOffset | 3 | getTimezoneOffset 按每个 Date 时间戳动态计算（含夏令时） | ✅ |
| emoji | 3 | Windows 固有；UA 平台伪装增强可改善 UA/UA-CH 一致性 | ⚠ 显示 1 分 |

## 功能开关

- 时区伪装 / 浏览器语言 / 中文字体拦截 / WebRTC 拦截 / Intl 区域 / 请求语言伪装
- **UA 平台伪装**（增强，默认关）：伪装 macOS 平台（JS 层 + 网络层同步），开启后 cnBrowser/deviceVendor 在国产 UA 环境下也受保护
- 代理时区自动检测（ipwho.is），支持港澳/大陆时区风险提示
- 总开关 = 一键全开/全关（与子开关实时联动，无中间态）

## 已知边界（诚实声明）

- **Web Worker / Service Worker**：独立 JS 环境无法被 content script 覆盖（检测站当前不使用，未来对抗面）
- **渲染层指纹**：拦截 measureText 探测层，不改变真实文本渲染使用的字体
- **IP 地理信号**（x-vercel-ip-timezone/country）：由出口 IP 决定，必须依靠代理
- **TLS / HTTP2 指纹**：需代理层解决
- **hook 可观察性**：MAIN world hook 天然可被页面检测（current 站点不做）

## 安装

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择本目录
3. 点开插件栏盾牌图标使用

## 隐私说明

- 所有伪装在浏览器本地生效，不修改系统设置
- 代理时区检测访问 ipwho.is 查询出口 IP 地理（不发送任何个人数据）
- 检测结果零上传

## 设计原则：Sub 参数展示规范

每个伪装功能行下方的参数文本遵循统一语义：

- **展示恒定值**：页面此刻实际生效的值（通过页面内 selfCheck 读取）
- **功能开启** → 展示伪装值（即伪装后的当前值，如时区伪装开 → `America/New_York`）
- **功能关闭** → 展示真实值（如时区伪装关 → 系统真实时区）
- **纯值展示**：不加"当前："、"伪装："等前缀文案
- **异常用颜色**：参数与目标不一致时整行变红，不使用 ✓/✗ 符号
- **无法读取时**：显示"未注入 · 请刷新页面后重试"（真实值只能由页面内 content script 读取）

请求头类功能（Accept-Language）特殊说明：请求头对页面 JS 不可见，开启态展示改写后的请求头语言（与配置一致）；关闭态展示浏览器实际语言（以 navigator.languages 近似）。

WebRTC 特殊说明：展示分两层——防护层状态（拦截是否生效）与网络层真实值（泄漏的 IP 候选）。拦截开启时页面探测结果必为无泄漏，此时展示探测结论。
