# Agent Note: Japanese UI support — ja language pack and locale-neutral stacks

Status: implemented

[English](2026-09-15-japanese-ui-language-pack.md) | 中文

## Problem

Web 客户端只提供中文与英文，语言选择器没有第三项。内置字体栈把中文字体族（`'PingFang SC'`、`'Hiragino Sans GB'`、`'Microsoft YaHei'`）排在其他 CJK 字体族之前，因此日文在所有平台上都以中文字形变体渲染。以日语为主的部署需要该 locale 与正确的日文字形选择。

## Decision

日语以内置 zh/en 之外的语言包形式提供，而不是第三种内置 locale。`@deepseek-ai/dsh-client-locale-ja`（`packages/client/locale-ja`）在 dsh-web-app bundle 名单中激活，注册 `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })`，并通过按 locale 注册的 `register(ns, 'ja', dict)` 形式为每个内置命名空间注册一份日语词典。每份词典以 `LocaleDictOf<'ns'>` 声明并类型化导入其所属包：键缺失、多余或改名都会导致构建失败；语言包未覆盖的命名空间在运行时经声明的回退链落到英文。

本分支让 `packages/client/ui-theme/src/styles/base.css` 中的内置字体栈保持 locale 中立：不指定任何 CJK 字体族，由浏览器按页面语言选择字形集，`ja` 页面因此得到日文字形，而不是固定 `PingFang SC` / `Microsoft YaHei` 带来的中文字形。代码字体栈同样去掉了裸 `monospace` 结尾（Windows 上的 CJK 会退回 SimSun），改为以通用 sans 收尾。各角色的字体族与字号选择仍由 ui-theme 的字体设置负责，用户列表排在这些字体栈之前。

## Alternatives considered

- **把 `ja` 作为 `LOCALE_IDS` 的一等成员。** 类型化的 `register(ns, { zh, en, ja })` 形式会强制每个包的注册都提供日语词典，并让上游每次字符串变更都成为本分支的冲突面。语言包是内置语言对之外语言的规定机制；已否决。
- **先做部分覆盖的语言包。** 部分翻译会让同一界面同时出现两种语言；语言包对当前命名空间提供完整覆盖，并以英文回退承接后续上游新增；已否决。
- **用特性插件保存用户所选字体族。** 字体定制已随上游 `ui-theme` 提供（正文、代码与终端的字体族和字号），本分支不再自带字体插件，只调整内置字体栈；已否决，避免重复实现。
- **把日文字体族钉进默认栈。** 在中文族之前加入 `'Hiragino Sans'` 会以日语优先栈牺牲中文字形选择，而浏览器默认本就能按页面语言兼顾两者；已否决，改为去掉 CJK 固定项，把字形选择交给浏览器。

## Consequences

- 语言包添加的是语言而不是字体控制：locale 中立的默认字体栈开箱即覆盖日文字形，用户可通过 ui-theme 的字体设置为各角色指定具体字体族。
- 语言包覆盖的每个命名空间都有编译期完整性约束；上游键改名会让语言包构建失败直到翻译跟进，这正是本分支需要的维护压力；运行时不会出现空白键，因为英文终止回退链。
- 语言包是纯增量：与上游同步时只会在发生键变更的词典模块产生冲突，以及在默认字体栈变化时冲突于 `base.css`。

## Testing

单元覆盖：语言包的 `apply.client.spec.ts` 经真实 `LocaleRuntime` 断言语言与词典注册以及卸载；`node-plugin.client.spec.ts` 保证 node 半边可调用。`settings-chrome` Web e2e 场景覆盖建立在这些字体栈之上的上游字体设置行。
