---
description: "dsh Web GUI 的日语（ja）语言包：ja 语言定义，以及按 locale 注册表为每个内置命名空间提供的一份类型化词典。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-locale-ja

[English](README.md) | 中文

## 概述

`dsh-client-locale-ja` 为 Web GUI 的语言选择器增加日语。浏览器半注册 `ja` 语言定义，并为客户端内置注册的每个命名空间注册一份日语词典，因此整个界面无需刷新即可切换为日语；Node 半为空，仅用于让插件成为 Loader 条目。语言包未覆盖的词典经该语言声明的回退链落到英文。移除该包在 bundle 名单中的行即可从选择器移除日语，当前 `ja` 选择会回到可用 locale。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

打开「设置」→「通用」→「语言」，选择「日本語」。界面文案立即切换，选择与内置的中文、英文选择一样持久化。无需任何配置：dsh-web-app bundle 会挂载该语言包，`<html lang>` 跟随当前 locale（`ja`）。浏览器自身语言为日语时，首次访问即选中它。

若要移除日语，请从 dsh-web-app bundle 名单中删除 `locale-ja` 行；该包的贡献随插件 fiber 一并释放。

### 更新翻译

每份词典位于 `src/client/dicts/<namespace>.ts`，以 `LocaleDictOf<'<namespace>'>` 声明，并类型化导入其所属包。键缺失或多余都会编译失败，因此上游键改名会让本包构建失败，直到翻译跟进。注册表后续新增的命名空间在语言包提供词典之前以英文呈现。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

语言包是纯增量：它绝不修改 locale 注册表或其他功能包。

### 注册

`apply` 通过 `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })` 注册语言定义，并通过按 locale 注册的 `ctx.locale.register(ns, 'ja', dict)` 形式注册每份词典，全部作为一个 fiber 中持有的 effect。释放时会精确移除这些贡献。注册表把 `ja` 追加在内置 `zh`/`en` 对之后，从而固定其在选择器中的位置。词典可以先于或后于语言定义注册；运行时按命名空间解析它们。

### 词典类型

`LocaleDictOf<N>` 解析所属包合并进 `LocaleNamespaceMap` 的精确键联合，因此每份词典在构造上就是完整的。类型化导入加载声明所在模块：若所属包的词典模块自身携带 `LocaleNamespaceMap` 声明，则导入该模块；否则导入加载它的客户端入口（有若干所属方把声明放在注册表旁，而非词典旁）。所属方未声明键联合的命名空间——`directory-browser`——以按 locale 形式注册，并类型化为 `Record<string, string>`。

### 源码地图

| 文件 | 角色 |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | 语言定义与词典注册 effect |
| [`src/client/dicts/`](src/client/dicts/) | 每个命名空间一份日语词典，以及排序后的注册表清单 |
| [`src/index.ts`](src/index.ts) | Node 半：空 apply，让 Loader 可以挂载该行 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [locale](../locale/README.zh.md)——本包扩展的注册表，以及它所实现的语言包约定。
- [ui-theme](../ui-theme/README.zh.md)——本包翻译的「通用」设置行。
- [客户端分组地图](../README.zh.md)——本包所属的浏览器半。

-----

<a id="model-experience"></a>
## 模型体验

无。语言包是浏览器端 UI 层，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制定义语言包不拥有什么，以及上游变动会落在哪里。

- **上游键变更会让构建失败，新增不会**——改名或删除的键在这里无法通过类型检查；上游新增的命名空间在补上词典之前以英文回退。
- **语言特定行为归语言包所有**——注册表提供选择、持久化、浏览器匹配、按键回退与 `<html lang>`；语言包不提供复数规则、双向排版或 locale 感知格式化。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生入口。语言包与注册表的关系是由其 apply spec 断言的注册/释放行为；没有可对比的独立运行时来源。
