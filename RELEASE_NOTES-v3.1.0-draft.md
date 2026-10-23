# v3.1.0 发布说明

## 新功能

- UA-CH 请求头补全：`Sec-CH-UA` / `Sec-CH-UA-Platform` / `Sec-CH-UA-Mobile` / `Sec-CH-UA-Platform-Version` / `Sec-CH-UA-Full-Version-List` 与页面内伪装值联动，堵住请求头层面泄露
- Intl 扩展覆盖：`Intl.Locale` / `Intl.DurationFormat` 无参构造时注入目标 locale，与伪装的 Accept-Language 一致（`intlExtended` 独立开关，默认关闭）

## 修复

- 配置写入静默失败：`saveConfig` 现在正确处理 `chrome.runtime.lastError`，失败时抛出错误
- 实时面板竞态覆盖：过时的刷新不再覆盖最新结果，loading 状态按行精确清除

## 优化

- 开关操作失败自动回滚：子开关与总开关统一执行入口，失败时将已变更的 DNR 规则恢复原状态
- 错误提示可视化：操作失败在信息区以红色持续展示，直到下一次成功覆盖
- Popup 界面精简：布局与样式优化，减少冗余功能入口

## 文档

- 新增 RELEASING.md 发布规范，统一版本号与产物命名
- ROADMAP 记录推迟 Date 本地时区 getter 链的理由
