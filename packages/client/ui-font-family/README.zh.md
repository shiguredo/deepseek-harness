---
description: "面向 Web GUI 的字体插件：持久的字体偏好、其在插件加载前的引导注入，以及在「一般」设置中把同一字体族应用到界面文字与代码的 Font 设置行。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-font-family

[English](README.md) | 中文

## 概述

本包端到端地拥有用户的字体族偏好：插件自身 Host 条目（`ui-font-family`）上的持久 `fontFamily` 字段、浏览器侧的配置表单绑定、承载所选字体族的两个 body 变量、插件加载前的引导注入，以及用于编辑它的「一般」设置 Font 行。未保存字体族时插件不写入任何内容，主题随附的字体栈保持原样；设置行只把用户给出的字体族应用到界面文字与代码。停用插件会移除设置行与持久字段，但不会改写任何随附字体栈。

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

在携带配置表单投影（`ui-settings`）、locale registry 与 slot registry 的 Web 组合中挂载本插件；web-app bundle 会把它挂在 `ui-theme` 旁边。profile 无需配置：持久的 `fontFamily` 值通过设置行编辑。

### 行为预期

「一般」设置中会增加一行 Font：一个持有 CSS font-family 列表的单行输入框，按 Enter 或失焦时提交。提交的列表会经过校验（去除首尾空白、最长 256 字符、不得包含 `;`、`{}` 或控制字符），持久化到插件自身的 `ui-font-family` Host 条目，并写入文档 body 的 `--dsw-font-family` 与 `--ds-font-family-code`，因此一次选择同时覆盖界面文字与代码。清空输入框会清除持久值并移除两个 token，使文档回到主题随附的字体栈；被校验拒绝的文本会留在输入框中并标记为无效，便于修正。保存了字体族时，索引引导会内联它，因此重新加载后的首次绘制在任何 client 插件激活之前就已带上它。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部 — 点击展开</summary>

### Host 半

`apply` 声明本插件的 `Config`（基于 `FontSettingsFields` 的 volatile `fontFamily` 字段），让该实例不出现在自动生成的设置页上，并在实时字体族已设置时，对每次 `webserver/index-inject` 收集回答一个 body 脚本。未保存字体族时不产生任何行，主题随附的字体栈保持默认。

### 浏览器半

`apply` 解析 `ctx.configForms.get('ui-font-family')`，即本插件自身 Host 条目共享的配置表单，并由一个 effect 订阅它：在首个 section 仍在加载时不写入任何内容（已存在的引导值保持不变）；此后每个被接受的 section 要么写入所选字体族，要么移除两个变量。同一 effect 的 disposer 会移除两个变量，使文档回到主题随附的字体栈。第二个 effect 注册 `settings.font` 字典，Font 行则注册进 `settings.general.item`（order 12、id `font-family`），并带一个以 revision 守卫、镜像表单的 store；注入面在写入前先做归一化，因此无效文本永远不会上线。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当单看该设置行或这两个 token 不够时，请阅读以下页面；它们从本设置走向它所覆盖的主题以及它写入所用的设置传输。

- [dsh-client-ui-theme](../ui-theme/README.zh.md) — 共享「一般」section 的主题 registry 以及 Appearance 与字号行。
- [dsh-client-ui-layout](../ui-layout/README.zh.md) — 在文档上负责调色板与排版 token 的 presenter。
- [dsh-client-ui-settings](../ui-settings/README.zh.md) — 配置表单投影、schema 校验与「一般」item 席位。
- [Web 样式](../../../docs/web-styling.zh.md) — 样式归属以及本设置所覆盖的 token 层。

-----

<a id="model-experience"></a>
## 模型体验

无。本包是围绕用户界面偏好的浏览器 chrome，不注册 prompt、schema 或 session 事件。

#### KV Cache 影响

无；本包既不会组装也不会发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了该设置拥有什么、以及刻意不处理什么。

- **文字与代码共用一个字体族** — 比例字体也会让代码变成比例字体；若要按界面区分为两套，需要两个字段和两行设置。
- **进程内页面保持随附字体栈** — 当设置传输仅存在于内存（非 loopback 页面且宿主不提供持久化）时，设置行仍可编辑但不会写入，也不会应用任何变量，这与配置表单自身的写入约定一致。
- **没有按语言或按文字系统的字体栈** — 设置行用用户给出的列表覆盖两个 token；以日语为主的部署应保存自己的首选字体族，而不是依赖随附默认值。
- **随附字体栈始终是默认** — 插件从不改写主题排版；未保存字体族时不写入任何内容。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

None.

</details>

**运行时不变式：** 不发布 companion。本插件拥有一个 Config 字段、一项索引注入贡献、一次表单订阅、一个 slot 条目与一个字典 effect，全部随 fiber 释放；表单快照是唯一的跨渲染状态，body 变量是它的纯投影。
