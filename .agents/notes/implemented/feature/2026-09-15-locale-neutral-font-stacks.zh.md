# Agent Note：面向 CJK 文本的与语言无关字体栈

Status: implemented

[English](2026-09-15-locale-neutral-font-stacks.md) | 中文

## 问题

内置字体栈在其他任何 CJK 字族之前指定了中文字族（`'PingFang SC'`、`'Hiragino Sans GB'`、`'Microsoft YaHei'`），代码栈也以这些同一批中文字族结尾。于是语言为日语的页面在所有平台上都会用中文字形渲染汉字，而它的等宽文本也无法回落到通用字族：字体栈终止于 CJK 字族，而不是浏览器按语言解析出的通用字族。

## 决定

本 fork 让 `packages/client/ui-theme/src/styles/base.css` 中的内置栈保持与语言无关。文本栈不指定任何 CJK 字族，CJK 字形由浏览器按页面语言解析；代码栈同样以通用 sans 结尾，而不是 CJK 字族，因此 Windows 上的 CJK 文本不会回落到 SimSun。各角色的字族与字号仍由 ui-theme 的字体设置决定，它把用户列表（`--dsh-font-family-text`、`--dsh-font-family-code`）放在这些栈之前应用到 `body`。

日语 UI 文本本身不再属于本 fork 的关注点：客户端已注册 `ja`，且每个内置包都带有完整的日语字典，因此本 fork 不再自带语言包。

## 考虑过的替代方案

- **在默认栈中优先放置日文字族。** 把 `'Hiragino Sans'` 排在中文族之前能修好日语，却会让中文页面使用错误的字形，而浏览器本来就按页面语言为两者解析。因此改为移除 CJK 固定项。
- **用功能插件保存所选字族。** 字体自定义已随 ui-theme 提供（文本、代码与终端的字族与字号），因此本 fork 不保留自己的字体插件，只调整内置栈。该方案与既有行为重复，被否决。
- **保持随附字体栈不变，依赖用户字体设置。** 未配置字族的部署仍会用中文字形显示日语文本，而默认值本就应该覆盖这种情况。被否决。

## 后果

- 字形选择开箱即随页面语言，需要指定字族的用户可通过 ui-theme 的字体设置命名。
- 这里的 fork 自有差异只剩默认字体栈本身；上游对 `base.css` 的改动只会在该文件内产生冲突。

## 测试

`settings-chrome` 的 web e2e 用例在这些栈之上覆盖了 ui-theme 的字体设置行。
