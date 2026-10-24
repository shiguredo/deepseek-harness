---
description: "在智能体执行提交类 Git 命令前向用户确认的提交守卫：为新会话提供一个默认值，并为每个会话提供一个开关，面向选择、配置或调试该插件的用户与维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-git-commit-guard

[English](README.md) | 中文

## 概述

该包阻止智能体自行创建 Git 提交。当某个会话的守卫开启时，经工具管线执行的提交类 Git 命令（`git commit`、`merge`、`rebase`、`cherry-pick`、`revert`、`am`、`commit-tree`）会等待用户在 Web UI 中确认。问题中显示确切的命令：选择 **Allow** 执行这一条命令，选择 **Reject** 则阻止并返回模型可见的理由。决定由两个独立设置驱动——新会话的默认值与每个会话自己的选择。不会添加任何仓库钩子。

## 目录

- [使用该包](#use-this-package)
- [了解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发者注记](#dev-note)

-----

<a id="use-this-package"></a>
## 使用该包

在 Web 或 Desktop 组合中挂载该插件：确认问题需要浏览器 UI，因此没有已连接 Web 客户端的配置无法批准提交，守卫会失败关闭。随附的 Web 组合包已运行它。输入框芯片切换单个会话，内置插件设置卡片设置新会话的默认值；该插件不注册斜杠命令。

### 何时选择它

当智能体工作的仓库必须让提交历史保持在人工控制之下时使用它。无人值守的运行——CI、无头自动化或无人查看的会话——不适合启用它，因为那里的提交会一直处于阻断状态而无人回答。

### 设置

| 设置 | 默认值 | 含义 |
|---|---|---|
| `stateFile` | `$DSH_HOME/commit-guard/state.json` | 持久化设置文件的绝对路径 |
| `defaultEnabled` | `true` | 没有存储选择的会话启动时是否开启守卫 |

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-git-commit-guard)记录了所有接受的值。

### 用户控制的内容

输入框中的 **Commit guard ON / OFF** 芯片只修改它所在的会话；之后的默认值变化不会影响已经做出选择的会话。时雨堂内置插件设置卡片修改新会话的默认值，`defaultEnabled` 配置在任何浏览器写入之前提供该初始值。两个层级都保存在同一个 `stateFile` 中，并且不会写入会话消息。许可是按次生效的：下一次提交仍会再次询问。

### 智能体看到的内容

被阻止的提交不会执行。智能体把拒绝当作普通的工具错误读取：`Git commit guard: the user rejected this commit, so nothing ran. Do not retry unless the user asks you to commit.` 当无法获得人工回答时——没有已连接的 Web 客户端、无头组合，或无法打开人工交互的子智能体——该调用会以对应的理由失败关闭，而不是执行。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

该插件注册一个 `tools/pre-execute` 监听器、一个精确 Web 路由、一个 `agent/created` 观察者和一个系统提示词段落。它需要 `webServer`、`connection`、`tools`、`systemPrompt` 和 `userQuestions` 服务。

### 拦截与确认

监听器识别 `bash` 与 `terminal_send` 调用中的提交类 Git 子命令：跳过环境变量赋值和 Git 全局选项（`-C`、`-c`、`--git-dir` 等），穿透包装器（`sudo`、`env`、`sh -c`、`eval` 等），并检查每个 shell 片段。识别只是便利，不是沙箱：智能体自己写进脚本中的命令不会被检测到。已识别且所在会话守卫开启的调用会用一条结构化问题调用 `userQuestions.ask()`，问题详情携带确切命令；`Allow` 会交给下一个 pre-execute 监听器，其他回答返回拒绝。取消返回 `cancel`，无法提问则返回拒绝而不是执行。

### 两个独立设置

`stateFile` 保存 `{ "default": boolean, "sessions": { "<sessionId>": boolean } }`。没有存储选择的会话在首次使用时捕获当前默认值，因此修改默认值不会覆盖已有会话。Web 路由为两个层级提供读写，并在回答前调用 `connection` 服务的 `requestRejection` 检查，由 Connection 拥有的 Host/Origin 与身份验证检查保护浏览器控制面。两个设置都与会话的权限预设和审批策略无关。

### 源码地图

| 文件 | 作用 |
|---|---|
| [`src/index.ts`](src/index.ts) | 插件入口：监听器、提问、路由、提示词段落、状态接线 |
| [`src/commit-command.ts`](src/commit-command.ts) | 对提交类 Git 子命令的 shell 命令识别 |
| [`src/state.ts`](src/state.ts) | 持久化的默认值与每会话选择，首次使用时捕获 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Tools 子系统参考](../../../docs/subsystems/tools.zh.md) — pre-execute 管线及其决定。
- [Approval 子系统参考](../../../docs/subsystems/approval.zh.md) — 本插件与之组合而非替代的相邻人工决定接缝。
- [用户问题](../../interaction/user-questions/README.zh.md) — 用于确认的问题/回答接缝。

-----

<a id="model-experience"></a>
## 模型体验

### 提交守卫策略段落

#### 模型看到的内容

当目标会话的守卫开启时，每次组装的请求都包含下面的段落。守卫关闭的会话不贡献任何内容。

##### 会话策略段落

```markdown
Git commit guard is enabled in this session: commit-creating Git commands (git commit, merge, rebase, cherry-pick, revert, am, commit-tree) do not run until the user answers the confirmation question the Harness shows right before the command runs. If the user rejects it, do not retry unless the user asks you to commit. The user can turn the guard off for this session from the guard chip in the composer.
```

#### Token 影响

目标会话守卫开启时每个请求一段固定文字；守卫关闭的会话不产生 token。

#### KV Cache 影响

与保留历史无关。切换目标会话的守卫会在下一次组装时替换该段落，并可能从那时起使复用失效；设置不变时保留既有前缀。

### 被拒绝的提交

#### 模型看到的内容

被拒绝的调用以上面的拒绝消息之一作为工具错误失败，命令自身的输出不会出现。确认问题由用户 UI 回答，不属于模型上下文。

##### 拒绝消息

```markdown
Git commit guard: the user rejected this commit, so nothing ran. Do not retry unless the user asks you to commit.
```

##### 无法获得回答时的消息

```markdown
Git commit guard: the user could not be asked to confirm this commit, so nothing ran.
```

#### Token 影响

被拒绝时产生一条有界的工具错误消息；调用执行时不增加 token。

#### KV Cache 影响

仅追加：拒绝属于保留的工具历史，不会重写可复用的请求前缀。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制说明该守卫何时不适合使用。它们是当前的包约束，而不是任务清单。

- **命令是识别而非全程拦截** — 脚本、make 目标或混淆命令中的提交不会被看到；守卫减少事故，不是沙箱。
- **确认需要存活的 Web 页面** — 无头组合与子智能体无法回答，因此那里的受守卫提交会一直阻断；无人值守部署应关闭守卫。
- **默认值只到达没有存储选择的会话** — 已有会话永远保留自己的值，而且没有批量应用；请从内置插件设置卡片或 `defaultEnabled` 配置修改默认值。
- **该路由是进程内 Web 关注点** — Desktop 与其他载体必须提供 `webServer` 和 `connection`；缺少两者的组合不会激活该插件。
- **只检查两个 shell 工具** — 未来能创建提交的工具必须显式加入该监听器。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 — 点击展开</summary>

无。

</details>
