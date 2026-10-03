# Agent Note: Japanese UI support — ja language pack and font-family plugin

Status: implemented

[English](2026-09-15-japanese-ui-language-pack-and-font-setting.md) | 中文

## Problem

Web 客户端只提供中文与英文，语言选择器没有第三项。内置字体栈把中文字体族（`'PingFang SC'`、`'Hiragino Sans GB'`、`'Microsoft YaHei'`）排在其他 CJK 字体族之前，因此日文在所有平台上都以中文字形变体渲染，也没有让用户选择字体的入口。以日语为主的部署需要该 locale、正确的日文字形选择，以及指定具体字体族的能力。

## Decision

日语以内置 zh/en 之外的语言包形式提供，而不是第三种内置 locale。`@deepseek-ai/dsh-client-locale-ja`（`packages/client/locale-ja`）在 dsh-web-app bundle 名单中激活，注册 `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })`，并通过按 locale 注册的 `register(ns, 'ja', dict)` 形式为每个内置命名空间注册一份日语词典。每份词典以 `LocaleDictOf<'ns'>` 声明并类型化导入其所属包：键缺失、多余或改名都会导致构建失败；语言包未覆盖的命名空间在运行时经声明的回退链落到英文。

字体行为由独立插件 `@deepseek-ai/dsh-client-ui-font-family`（`packages/client/ui-font-family`）提供。它声明插件自身的 `Config`，即 `ui-font-family` Host 条目上的 volatile `fontFamily` 字段，并拥有 body 上的两个变量 `--dsw-font-family` 与 `--ds-font-family-code`。该条目未保存字体族时插件不写入任何内容，主题随附的字体栈保持默认；保存了字体族时写入这两个变量，且插件的 index bootstrap 会内嵌它，因此刷新后的首帧即已带上用户的选择。

该插件把「字体」行注册进「通用」设置分区：自由填写的 CSS font-family 列表，在 Enter 或失焦时提交；规范化拒绝的文本留在输入框内供修正；清空后回到随附字体栈。注入面在经 `ctx.configForms.get('ui-font-family')` 写入之前先做规范化（去空白、256 字符上限、禁止 `;`、`{}` 与控制字符）；每个被接受的 section 要么写入所选字体族，要么移除两个变量，卸载插件时也会移除。

新增的 `settings.font` 文案（`fontFamily.title`、`fontFamily.description`、`fontFamily.placeholder`）随插件的 zh/en 词典与语言包的日语词典一同发布。

## Alternatives considered

- **把 `ja` 作为 `LOCALE_IDS` 的一等成员。** 类型化的 `register(ns, { zh, en, ja })` 形式会强制每个包的注册都提供日语词典，并让上游每次字符串变更都成为本分支的冲突面。语言包是内置语言对之外语言的规定机制；已否决。
- **先做部分覆盖的语言包。** 部分翻译会让同一界面同时出现两种语言；语言包对当前命名空间提供完整覆盖，并以英文回退承接后续上游新增；已否决。
- **预设字体列表（Hiragino Sans、Noto Sans JP、Yu Gothic 等）。** 预设把各平台的字体可用性写死，仍会漏掉本地安装的字体族；经校验的自由填写覆盖所有平台；已否决。
- **只作用于正文字体。** 日文也会出现在代码块与终端输出，由代码 token 决定；两个 token 同时写入才能让一次选择保持一致；已否决。
- **把日文字体族钉进默认栈。** 在中文族之前加入 `'Hiragino Sans'` 会以日语优先栈牺牲中文字形选择，而浏览器默认本就能按页面语言兼顾两者；已否决，改为只提供显式设置，未使用时不触碰随附字体栈。
- **让插件自带 locale 中立的默认字体栈。** 插件的早期版本在未保存字体族时写入自己的 `system-ui` / 拉丁默认字体栈；已否决：特性插件不应把产品级排版默认值硬编码进来，主题随附字体栈本就拥有该默认值，而用户要求的只是一个可控的设置行。
- **把字体设置留在 ui-theme 内。** 该设置最初是主题命名空间上的可选字段 `fontFamily`，其行、快照、presenter 接线与 boot 注入都在 `ui-theme`/`ui-layout`；已否决：那样本分支的字体定制会散落在三个上游包中，而独立插件让它们保持不变，并可按 profile 整体移除。

## Consequences

- 语言包添加的是语言而不是字体：未保存字体族时随附（固定 CJK 字体族的）字体栈仍然生效，因此以日语为主的部署应在设置行中保存自己的首选字体族。
- 语言包覆盖的每个命名空间都有编译期完整性约束；上游键改名会让语言包构建失败直到翻译跟进，这正是本分支需要的维护压力；运行时不会出现空白键，因为英文终止回退链。
- 语言包是纯增量：与上游同步时只会在发生键变更的词典模块产生冲突，绝不触及所属包。
- 用户指定的字体族同时作用于界面文本与代码；选择比例字体时代码也会变为比例字体，直到清空该字段。
- 字体插件同样是纯增量：上游主题包不含任何字体设置代码，停用插件会一并移除设置行与持久字段，而不会改写任何随附字体栈。
- 「字体」行在共享配置表单之上参与插件自身的 revision 守卫 store；其持久值由插件的 Config schema 校验。

## Testing

单元覆盖：`font-settings.client.spec.ts`（规范化与上限）、`config.host.spec.ts`（Config 校验、页面省略与按需产生的引导行）、`apply.client.spec.ts`（表单绑定、变量应用与移除、加载期围栏、行注册与 face 写入与卸载）、`font-family-row.client.spec.tsx` 与 `settings-store.client.spec.ts`。`settings-chrome` Web e2e 场景应用字体、断言两个 body 变量与 profile patch、刷新后复查并清空回随附字体栈。语言包的 `apply.client.spec.ts` 经真实 `LocaleRuntime` 断言语言与词典注册以及卸载。
