---
description: "切换单个 Session 的 Git 提交防护的输入框芯片，以及设置新 Session 防护默认值的内置插件设置卡片，面向组合该内置防护的用户与维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-commit-guard

[English](README.md) | 中文

## 概述

该包是 Git 提交防护的浏览器半边。它提供两个界面：显示并切换目标 Session 防护的输入框芯片，以及插件页面中**时雨堂内置插件设置**分组里设置新 Session 默认值的卡片。两者都通过 Host 包的同源 `GET|POST /commit-guard/state` 路由读写；持久化、强制执行与确认提问由 Host 负责。两个界面都不会写入 Session 消息，该包也不提供侧边栏页面。

## 目录

- [使用该包](#use-this-package)
- [行为说明](#what-to-expect)
- [了解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用该包

将该插件与注册 `/commit-guard/state` 并拥有防护的 [`@deepseek-ai/dsh-git-commit-guard`](../../guard/git-commit-guard/README.zh.md)、提供 `conversation.input.left` 座位的 [`dsh-client-ui-conversation`](../ui-conversation/README.zh.md)，以及提供 `plugins.item` 座位的 [`dsh-client-ui-plugin-manager`](../ui-plugin-manager/README.zh.md) 一起挂载。该插件不接受配置。芯片出现在每个 Session 的输入框工具行中，并且只作用于该 Session；设置卡片出现在内置插件设置中。

<a id="what-to-expect"></a>
## 行为说明

芯片在小的锁形图标旁显示“提交防护已开启”或“提交防护已关闭”，在首次读取完成前显示“加载中…”。读取或写入进行中时保持禁用。点击后发送 `{ enabled, sessionId }`，只修改该 Session；新 Session 的默认值不变。工具提示说明当前设置，并说明新 Session 的默认值不变。芯片在挂载时、窗口获得焦点时以及 `visibilitychange` 时重新读取，因此其他客户端写入的变更会在本客户端下次获得焦点或标签页可见时出现。读取或写入失败时芯片以错误色显示，并把本地化的失败文本放进工具提示，同时保留最后已知的标签。

时雨堂内置插件设置卡片用开启/关闭控件显示新 Session 的默认值。它在页面打开时读取无参数路由，并在用户选择值时发送 `{ enabled }`。读取或写入失败时在卡片内显示本地化的失败行。卡片在设置列表中显示一行摘要；其提示说明变更只影响新 Session，已有 Session 请通过输入框芯片切换。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

`apply` 注册一个带类型的字典命名空间和两个 slot 贡献：`conversation.input.left`，id 为 `git-commit-guard`、order 为 40（芯片）；`plugins.item`，id 为 `git-commit-guard`、order 为 60（内置插件设置卡片，其标签跟随语言环境）。两个注册都声明 `gitCommitGuard` 语言命名空间，因此渲染器提供 `t` 座位，并注入一个在 `apply` 中构建一次的路由面——`loadState`/`saveState` 闭包持有 Host 的路由 URL。该共享身份使组件的挂载 effect 不会在每次渲染时重新请求。路由辅助函数位于插件内（`src/client/state.ts`），不是服务导入；它们校验 JSON 应答（非对象体、缺失布尔字段或非 2xx 状态都会拒绝），并把失败呈现为各界面自己的静默错误状态。组件只持有本地状态——已加载的设置、进行中标志和失败标志。字典注册与两个 slot 贡献都是插件 fiber 的 effect，因此卸载插件会同时移除芯片、卡片与其文案。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [`dsh-git-commit-guard`](../../guard/git-commit-guard/README.zh.md) —— Host 防护、其状态路由与确认提问。
- [dsh-client-ui-conversation](../ui-conversation/README.zh.md) —— 声明芯片所在的 `conversation.input.left` 输入框座位。
- [dsh-client-ui-plugin-manager](../ui-plugin-manager/README.zh.md) —— 拥有插件页面与 `plugins.item` 设置座位。
- [dsh-client-locale](../locale/README.zh.md) —— 本插件文案遵循的字典注册表与语言选择。
- [Slots 参考](../../../docs/subsystems/slots.zh.md) —— 插件如何注册到另一个插件声明的 slot。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md) —— 浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无，因为该包只呈现通过 Host 的 HTTP 路由写入防护状态的浏览器界面，不注册任何面向模型的内容。

#### KV Cache 影响

无；该包既不组装也不发送模型请求。守卫的模型可见提示词段落由 Host 防护包拥有。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明已发布界面的范围以及它刻意不做的事。

- **状态路由是唯一接口** —— 如果 Host 包没有提供 `/commit-guard/state`，两个界面都会加载失败；缺少路由时它们保持内联失败状态而不是隐藏。
- **设置卡片不是 profile 开关** —— 它修改之后创建的新 Session 的默认值；已有 Session 保留自己的值，而且 profile 组合变更仍可通过 `defaultEnabled` 覆盖默认值。
- **按设计不写 Session 消息** —— 切换某个 Session 的设置或默认值只持久化路由状态；会话记录既不记录变更也不记录其作者，因此重放本身无法解释之后的防护决定。
- **其他客户端的变更最终可见** —— 芯片在挂载、获得焦点和可见性变化时重新读取，而不是实时推送，因此别处做的变更可能在下一次聚焦或挂载前不可见。
- **芯片不创建 Session 或 Host agent** —— 它需要所在输入框的标准 `sessionId`，在该座位提供之前会失败关闭。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

无。

</details>
