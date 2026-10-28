---
description: "面向前端 GUI 的 composer 统计块与问题卡片 git 芯片：读取当前 Session 工作区所在的 checkout——GitHub 仓库、分支，以及链接 worktree 时的名称与路径——通过 workspaceGit Remote namespace。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-branch

[English](README.md) | 中文

## 概述

本包渲染 composer 会话统计行与问题卡片头部的首个芯片，命名当前 Session 工作区所在的 checkout。页面级 controller 监视已挂载芯片的 Session，在页面可见时每 15 秒轮询宿主的 [`workspaceGit`](../../api/workspace-git/README.zh.md) Remote namespace，并在页面重新可见以及投影工作目录变化时刷新。触发器读出 GitHub 仓库与 ref（`owner/repo:branch`，detached HEAD 时为 `owner/repo@abc1234`），其后始终后缀 checkout 根的绝对路径，仅当 Session 工作在链接 worktree 中时再后缀其目录名。点击会打开逐行列出各项事实的详情对话框，包含仓库 URL。仓库之外的目录、不可用的 git 以及失败的读取都不显示任何内容。

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

在 [`dsh-api-workspace-git`](../../api/workspace-git/README.zh.md)、[`dsh-client-ui-chat`](../ui-chat/README.zh.md) 与 [`dsh-client-ui-user-questions`](../ui-user-questions/README.zh.md)（后两者声明各自的席位）以及 conversation 界面旁挂载本插件；工作区属于仓库的每个 Session 便会在统计块首行显示该芯片，takeover 隐藏该块时则显示在问题卡片头部。本插件不需要任何配置。

### 行为预期

芯片只读：它是一个触发器，图标与标签读出该 checkout 的 GitHub 仓库与 ref，始终后缀 checkout 根的绝对路径，仅当 Session 工作在链接 worktree 中时再后缀其目录名；tooltip 与屏幕阅读器标签点明其角色（“Branch shiguredo/moqt-js:main at /srv/moqt-js”，链接时带 “(worktree moqt-js-audio-playout)”）。点击会打开锚定于触发器的对话框，逐行列出各项事实——分支（detached HEAD 时为短 commit id）；链接时的 worktree 名称；根路径；以及 GitHub 仓库 URL——Escape 或外部指针按下会关闭它。在首次答案之前或仓库之外不渲染任何内容；remote 不指向任何 GitHub 仓库时，仓库行保留占位符而 ref 仍然显示。即使 Session 尚无任何统计数字，该块也会为芯片保留位置；整行都无内容时则不占布局。composer takeover（问题或计划评审）会随输入栏一起隐藏统计块，因此问题卡片头部携带同一个芯片；两个已挂载芯片每个 Session 共享一次监视。卸载插件会移除芯片、controller 及其定时器。工作目录发生变化的 Session——worktree 工具进入链接 checkout——会立即重读其 checkout，因为芯片跟随客户端可见的 `workingDirectory` 投影；只有在终端切换的分支才等待轮询。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部 — 点击展开</summary>

本插件向两个首个席位各注册一个 `GitBranchChip` 占据者——ui-chat 的统计块与 ui-user-questions 的问题卡片头部——并注册一个字典 effect。统计块随 composer 一同挂载，并在 pill 与席位都没有内容时通过 `:has` 收起，因此芯片不受首个已完成 step 的限制；问题卡片头部以相同方式收起其首要行。芯片通过 inject face 在挂载时调用 `acquire(sessionId)`、卸载时调用 `release(sessionId)`；controller 按 Session 统计已挂载的芯片数量，唯一的 interval 与 `visibilitychange` 监听在第一次监视时启动，并在最后一次释放时停止两者。每个 Session 至多只有一个进行中的读取；进行中时的重复轮询会被跳过而非排队；每个结算都由监视 generation 隔离，因此已释放或重新获取的 Session 会丢弃迟到的答案。读取失败保留上一次发布的答案，答案未变化则不发布任何内容，因此 store 的 snapshot 标识只在 checkout 变化时移动——ref、worktree 根路径或名称、或仓库。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当芯片自身的信息不足时，请阅读以下页面；它们从浏览器入口出发，走向其数据与组合模型。

- [dsh-api-workspace-git](../../api/workspace-git/README.zh.md) — 本芯片轮询的宿主服务。
- [dsh-client-ui-chat](../ui-chat/README.zh.md) — 声明芯片第一个席位的统计块。
- [dsh-client-ui-user-questions](../ui-user-questions/README.zh.md) — 声明芯片 takeover 席位的问题卡片。
- [Slots reference](../../../docs/subsystems/slots.zh.md) — 插件如何注册进另一个插件声明的 slot。
- [Web client architecture](../../../docs/subsystems/web-client.zh.md) — 浏览器插件行如何加载并注册 slot。

-----

<a id="model-experience"></a>
## 模型体验

无。芯片是围绕工作目录事实的浏览器 chrome，不触及 prompt、消息、schema 或工具结果。

#### KV Cache 影响

无；本包既不会组装也不会发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了当前芯片的范围，以及它刻意不做的事。

- **轮询基于时间** — 页面保持可见时，在终端切换分支或 worktree 会在一个轮询间隔（15 秒）内出现，而不是检出当下；Session 工作目录变化（worktree 工具）则会立即刷新。
- **每个被监视 Session 一次读取** — controller 不会合并同处一个工作区的两个 Session，因此同一仓库上的两个 Session 每次轮询各消耗一次 git 读取。
- **芯片只报告，不操作** — 不提供分支切换、复制或历史界面。
- **worktree 名称仅限链接 worktree** — main checkout 报告其根路径但不报告 worktree 名称，因为其目录就是仓库根；Host 通过比较 `git rev-parse --absolute-git-dir` 与 `--git-common-dir` 区分二者。
- **非 GitHub 即无仓库** — remote 托管在其他站点时仓库行保留占位符；仓库 URL 绝不根据目录名推测。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

None.

</details>

**运行时不变式：** 不发布 companion。本插件拥有两个 slot 注册与一个字典 effect，其释放由 HMR 安全性测试证明；controller 发布的 snapshot 是它唯一的跨渲染状态，不存在可能与之分叉的其他观测。
