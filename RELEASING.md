# 发布规范（RELEASING）

本文件约束 Fuck Claude Detection 的版本发布流程与产物命名。**每次发布必须遵循本文档**，不依赖口头约定或历史会话记忆。

## 1. 版本号

- 遵循语义化版本：`v主版本.次版本.修订号`（如 `v3.0.0`）
- Git tag 与扩展 `manifest.json` 的 `version` 字段、popup 头部版本标注**三处必须一致**
- 发布前检查清单：
  - [ ] `extension/manifest.json` → `version` 已更新
  - [ ] `extension/popup/popup.html` → `brand-sub` 版本标注已更新
  - [ ] `extension/content.js` / `popup.js` 语法验证通过（`node --check`）
  - [ ] `manifest.json`、`rules.json` JSON 解析通过

## 2. 产物命名（强制）

```
FuckClaudeDetection-v<版本号>.<扩展名>
```

- ✅ `FuckClaudeDetection-v3.0.0.crx`
- ✅ `FuckClaudeDetection-v3.0.0.zip`
- ✅ `FuckClaudeDetection-v3.0.0.xpi`
- ❌ 禁止：浏览器后缀（`-chrome` / `-firefox`，适用范围由 Release 表格说明）
- ❌ 禁止：格式版本后缀（`-mv3`，除非未来同时发布 MV2 变体才以 `-mv2` 区分）
- ❌ 禁止：无版本号的裸文件名（下载后无法与多版本并存区分）

格式语义由扩展名承载：`.crx` = Chrome 签名包、`.xpi` = Firefox、`.zip` = 通用解压加载。

## 3. 打包步骤（PowerShell）

```powershell
$ver = "v3.0.0"   # 与 tag 一致

# 1) zip（Chrome/Edge 通用，推荐普通用户）
$stage = "$env:TEMP\fcd-pack"
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -Recurse extension\* "$stage\" -Force
Compress-Archive -Path "$stage\*" -Destination "FuckClaudeDetection-$ver.zip" -Force

# 2) xpi（Firefox，zip 重命名）
Copy-Item "FuckClaudeDetection-$ver.zip" "FuckClaudeDetection-$ver.xpi" -Force

# 3) crx（Chrome 私钥签名；私钥 fuck-claude-detection_private.key 由维护者本地保管，严禁入库）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --pack-extension="$PWD\extension" --pack-extension-key="$PWD\fuck-claude-detection_private.key"
Move-Item extension.crx "FuckClaudeDetection-$ver.crx" -Force
```

> 注意：`--pack-extension` 输出目录随 Chrome 版本可能不同，打包后确认 crx/pem 位置；pem 必须移出仓库范围（`.gitignore` 已含 `*.pem` / `*.key`）。

## 4. Release 发布

1. 生成 SHA256：

```powershell
Get-ChildItem "FuckClaudeDetection-$ver.*" | ForEach-Object {
  (Get-FileHash $_ -Algorithm SHA256).Hash + "  " + $_.Name
}
```

2. 创建 Release（notes 模板要点）：
   - **正文不要写与 `--title` 重复的 H1 标题**（Release 页面会同时渲染，造成重复）
   - 简介一句话（不带括号分数说明）
   - 下载表格：文件列使用 `releases/download/<tag>/...` 的 Markdown 下载链接；适用列说明浏览器；说明列注明加载方式与实验性状态
   - SHA256 代码块（文件名与资产命名一致）
   - 安装后步骤；检测站地址使用 Markdown 链接
3. 命令：

```powershell
gh release create $ver --title "Fuck Claude Detection $ver" --notes-file release-notes.md --latest <产物文件...>
```

## 5. 发布后检查

- [ ] Release 页面标题无重复
- [ ] 资产命名符合第 2 节规范
- [ ] 表格下载链接可点击下载
- [ ] SHA256 与本地一致

## 6. 已知注意事项

- Firefox 版为 MV3 实验性支持（DNR 子集），Release notes 必须保留"未充分测试"标注
- UA 平台的 UA 版本从真实浏览器 UA 动态推导（`deriveMacUa`），升级无需手动维护版本号
- `ipwho.is` 为外部依赖；若不可用，代理时区检测失败时保持当前时区不变