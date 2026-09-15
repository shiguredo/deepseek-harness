---
description: "面向 Web GUI 的工作区 git 服务：通过 workspaceGit Remote namespace 提供 Session 工作区目录所在的 checkout——ref、worktree 目录与 GitHub 仓库。"
kind: "package-reference"
---

# @deepseek-ai/dsh-api-workspace-git

[English](README.md) | 中文

## 概述

本包为 Web GUI 回答一个宿主侧问题：当前 Session 工作区位于哪个 checkout。`workspaceGit` Remote namespace 在不激活 Agent、不读取事件正文的前提下解析 Session header 中的目录，通过组合的 subprocess provider 运行 `git` 读取，并把结果映射为三态联合——分支名、detached HEAD 时的短 commit id，或仓库之外的 `none`。两种找到仓库的答案还会带上该 checkout 的 worktree 目录名，以及当 `origin` remote 指向 github.com 时的 `owner/repo` 与仓库 URL。该答案是环境信息而非 Session 状态：不写入 session log，也不进入任何模型请求。

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

在携带 `sessions`、`subprocess`、`sandboxPolicy` 与 `typert` 的组合中挂载本插件，通常与其浏览器侧消费者 [`dsh-client-ui-git-branch`](../../client/ui-git-branch/README.zh.md) 一同使用。Client 调用 `remote.workspaceGit.status(sessionId, signal)`。

### 配置

| 字段 | 默认值 | 含义 |
|---|---|---|
| `timeoutMs` | 必填 | 一次 `git` 调用的截止时间（毫秒），从解析可执行文件到取得退出结果。 |

### 行为预期

一个答案可能命名已检出的分支（包括首次提交之前的未诞生分支）；可能给出 detached HEAD 的短 commit id；`none` 则对应仓库之外的目录、未安装 git 的宿主、已消失的工作区以及超时的调用。位于仓库内部的子目录会报告所属仓库。worktree 目录名取该 checkout 根目录的基本名，因此链接 worktree 报告的是 Session 实际工作的目录；没有工作树的仓库（bare repository）没有该名字。GitHub 仓库只从 `origin` 读取，且仅当该 URL 指向 github.com，因此不可达或托管在其他站点的 remote 只会让该字段为 null，ref 答案依然有效。以上都不作为错误抛出：拿不到的事实本身就是一种答案。每次调用都会依次启动 `git -C <workspaceRoot> branch --show-current`、`git rev-parse --show-toplevel` 与 `git config --get remote.origin.url`——HEAD 处于 detached 状态时再加一次 `git rev-parse --short HEAD`，仓库之外则只执行第一次读取——不做缓存，因此轮询的调用方自行决定轮询间隔。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部 — 点击展开</summary>

Session 级 lookup `workspaceGitScope` 解析 Session id 到工作区目录的方式与 `dsh-api-workspace-files` 解析 `workspaceFileScope` 完全一致：优先使用在线 header 的 `cwd`，否则读取冷 Session 的持久化 header，再否则使用 sandbox policy 的 workspace root；完全没有 header 的 Session 解析为 `undefined`，由 Gateway 报告 `gateway/lookup-not-found`。每次读取都把调用方的 signal 与部署截止时间合并后交给 spawn，因此超时会通过 subprocess provider 的常规终止流程中止受管进程范围。stdout 与 stderr 以 64 KiB 上限收集——每个答案都只有一行——非零退出、无法解析的 `git`、被拒绝的 spawn 以及超时中止都读作不可用。`branch --show-current` 一次覆盖三种 ref 情况：分支或未诞生分支给出名字，detached HEAD 给出空答案并由随后的短 id 读取补全，仓库之外则以失败告终。remote URL 按 git 保存的两种写法解析——带 scheme 的 URL（`https://`、`ssh://`、`git://`）与 scp 风格的 `[user@]host:path`——凡不是 `github.com/owner/repo` 的 URL 都不产生仓库。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当本服务自身的信息不足时，请阅读以下页面；它们从 wire 联合类型出发，走向其消费者以及它所依赖的 seam。

- [dsh-client-ui-git-branch](../../client/ui-git-branch/README.zh.md) — 轮询该 namespace 的 composer 统计行芯片。
- [dsh-api-workspace-files](../workspace-files/README.zh.md) — 本服务遵循的同门 Session 级 lookup。
- [dsh-subprocess](../../subprocess/subprocess/README.zh.md) — 负责 spawn、终止与输出收集的进程能力。
- [API Gateway](../../../docs/api-gateway.zh.md) — 生成的 Remote namespace 如何成为 Client 调用。

-----

<a id="model-experience"></a>
## 模型体验

无。本服务为浏览器 chrome 读取工作目录事实，不触及 prompt、工具 schema 或 session 事件。

#### KV Cache 影响

无；本服务既不会组装也不会发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制界定了本服务回答什么、以及刻意不回答什么。

- **不含工作树状态** — 只读取 ref、worktree 目录名与 origin 仓库；dirty、staged 与 ahead/behind 需要更重的 git 读取，轮询无法承受。
- **只识别 GitHub 链接** — 托管在其他站点的 remote、fork 的 `upstream`，以及不叫 `origin` 的 remote 都不可见；此时答案不携带仓库。
- **不做缓存** — 每次调用都会启动 git；缓存答案恰好在调用方轮询以了解变化时过期，想要减少进程开销的部署应降低轮询频率。
- **不提供分支列表或切换** — 服务只读取当前 ref。
- **宿主必须安装 `git`** — 未安装 git 的宿主对每个工作区都回答 `none` 而不是报错；该功能只是不出现。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

None.

</details>

**运行时不变式：** 不发布 companion。本服务不持有任何持久化或跨插件状态——每个答案都来自 Session header 与其子进程，其 lookup 注册的生命周期完全处于自身构造之内。
