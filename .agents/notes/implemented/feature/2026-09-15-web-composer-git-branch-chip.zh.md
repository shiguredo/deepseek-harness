# Agent Note: Web composer 的 git 分支芯片

Status: implemented

[English](2026-09-15-web-composer-git-branch-chip.md) | 中文

## 问题

Web GUI 会说明 Session 的工作区目录，却从不说明该目录所在的 checkout。以 worktree 为主的工作方式让路径成为一种糟糕的身份标识：同一仓库的多个检出仅分支与目录不同，而终端里的 checkout 会改变分支却不产生任何可更新页面的 Session 事件。harness 完全没有读取这一事实的入口——侧边栏中的构建期 commit 徽标是构建元数据，不是工作区状态——因此阅读对话的用户无法判断 agent 的文件修改落在哪个分支与 worktree 上，也无法判断该检出正在向哪个 GitHub 仓库推送。

## 决策

该功能由两个插件组成。一个宿主侧 Remote 服务为某个 Session 工作区回答 checkout，一个浏览器侧芯片把它渲染为 composer 会话统计行的首个占据者；两者都不触及 session log、prompt 或工具 schema。

### wire 答案

[`dsh-api-workspace-git`](../../../../packages/api/workspace-git/README.zh.md) 通过 Session 级 `workspaceGitScope` lookup 拥有 `workspaceGit` Remote namespace——与 `dsh-api-workspace-files` 相同的仅 header 解析方式，包括对没有 `cwd` 的 Session 使用 sandbox policy 回退。该注册刻意镜像这次解析而不抽取：两个姊妹服务各自拥有自己的 Remote namespace 与 Typert 描述符，且没有任何一个包拥有对方的服务。`status(sessionId, signal)` 返回一个封闭联合：

```ts ignore-check
export type WorkspaceGitStatus =
  | { kind: 'branch'; name: string; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'detached'; head: string; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'none' }
```

`none` 是答案而非错误：它涵盖仓库之外的目录、未安装 git 的宿主、已删除的工作区以及截止时间中止，因为芯片对这几种情况只有一种渲染方式。服务自己运行 git——`git -C <cwd> branch --show-current`（首次提交之前会给出未诞生分支的名字，detached HEAD 时给出空答案），答案为空时再运行 `rev-parse --short HEAD`，另外运行 `rev-parse --show-toplevel` 取 worktree 目录名、运行 `config --get remote.origin.url` 取仓库——并通过 `ctx.subprocess` 完成，因此 worktree、submodule 与 detached HEAD 都与 git 本身的解析结果一致。调用方的 signal 与部署的 `timeoutMs` 合并，同时约束 spawn 与进程范围的终止。remote URL 在宿主侧按 git 保存的两种写法解析，只有 `github.com/owner/repo` 才会产生仓库，因为芯片的链接绝不猜测 URL。

### 芯片

[`dsh-client-ui-chat`](../../../../packages/client/ui-chat/README.zh.md) 在会话统计行的行首声明一个首席席位 `conversation.composer.stats.lead`。该行随 composer 一同挂载，并在 pill 与席位都没有内容时通过 `:has` 收起，因此席位占据者不受 Session 首个统计数字的限制，整行无内容时也不占布局。[`dsh-client-ui-user-questions`](../../../../packages/client/ui-user-questions/README.zh.md) 在问题卡片顶部声明 `conversation.question.header.lead`，因为 takeover 会连同统计行一起隐藏 composer 栏；该头部以同一条 `:has` 规则收起这一行，因此没有占据者绘制时 takeover 也不会保留空带。

[`dsh-client-ui-git-branch`](../../../../packages/client/ui-git-branch/README.zh.md) 把同一个芯片注册进两个席位，并拥有一个页面生命周期的 controller。芯片读作 `owner/repo:branch (worktree)`——worktree 目录与仓库名相同时省略括号——detached HEAD 时读作 `owner/repo@abc1234 (worktree)`；`origin` 指向 GitHub 时整个芯片是一个在新标签页打开 `https://github.com/<owner>/<repo>` 的链接，并沿用相邻 pill 的悬停与焦点反馈，而 remote 不指向任何 GitHub 仓库时则只留普通文本。芯片在挂载时调用 `acquire(sessionId)`，在卸载时调用 `release(sessionId)`；controller 按 Session 统计已挂载的芯片数量，因此被隐藏的统计行与 takeover 头部共享一次监视、一个 15 秒 interval 与一个 `visibilitychange` 监听器，它们在第一次监视时启动、在最后一次释放时停止。每个 Session 最多只有一个读取在途，在途期间的轮询会被跳过；每次落定都由监视代次围栏，因此完全释放或重新获取的 Session 会丢弃迟到的答案。失败的读取保留上一次发布的答案，未变化的答案不发布任何内容，因此已发布快照的标识只在 checkout 真正变化时改变。

## 测试

宿主包由脚本化 subprocess 的 spec 覆盖答案映射、截止时间中止与 argv 形态，由一个纯 spec 覆盖 remote URL 的各种写法，并由针对临时仓库的真实 git spec 覆盖分支、未诞生分支、关联 worktree、detached HEAD、没有工作树的 bare 仓库、GitHub origin、非 GitHub origin 以及仓库之外的情况。客户端包由 controller spec（轮询节奏、可见性门控、在途跳过、代次围栏、失败读取、仅变化时发布、一次监视存活到最后一个已挂载芯片释放它）、芯片 spec（答案折叠、worktree 与仓库名相同时的省略、普通与链接渲染、标签、监视生命周期），以及卸载插件 fiber 并观察两个席位条目都被移除的 HMR 安全 spec 覆盖。ui-chat 的统计 spec 证明该行会为尚无数字的席位占据者保留；ui-user-questions 的提问与计划评审 spec 证明问题卡片把头部首席席位渲染在标题之上、渲染在评审条内，同时收起时不占任何空间。Web snapshot 套件保持无密钥回放安全，因为 assembled-remote 的默认响应把 fixture 目录的 `workspaceGit/status` 回答为 `none`，芯片在其中不渲染任何内容；没有头部占据者的 Session 问题卡片 DOM 也不变。

## 备选方案

- **在 `SessionSummary` 上增加分支字段。** 否决：这会把实时环境事实放进持久化的 Session 列表数据，其刷新跟随 Session 变化而非 checkout，并会让每次列表投影都增加一次 git 读取。
- **像 `dsh-host-open-in-app` 那样使用 `webServer` 路由对。** 否决：Session 级 Typert Remote 正是为这种数据形态而存在，它带来生成的 client、基于 lookup 的 Session 解析以及 `/api` 信任围栏，无需手写路由策略。
- **通过 `workspaceFiles.read` 读取 `.git/HEAD`。** 否决：worktree 的 `gitdir:` 间接层、detached HEAD 与 packed refs 让文件格式成为错误的权威；工作流本就要求 git 二进制。
- **监视 `.git/HEAD` 而不轮询。** 暂不采纳：文件系统 seam 没有 OS 监视，每个 Session 一个 watcher 相对可见性触发的轮询只快几秒，而轮询还是唯一能捕捉 agent 在轮次中途切换分支的触发方式。
- **dirty 与 ahead/behind 状态。** 否决：`git status` 的开销随工作树规模增长，轮询驱动的芯片无法承受；芯片只回答 checkout 问题。
- **宿主侧缓存。** 否决：缓存答案恰好在轮询的调用方想要新鲜结果时过期，而这些读取的进程开销很小。
- **把芯片放进 Session header。** 否决：header 在空白 Session 上会隐藏，而 composer 承载着 checkout 所描述的输入，并与它所属的统计相邻。
- **芯片独占一个 `conversation.composer.dock` 行。** 否决：dock 以整行堆叠，第二个行会让芯片浮在统计之上而不是与其同行；靠测量合并两行则要伸进另一个插件的布局。
- **composer 工具行（`conversation.input.left`）。** 否决：该既有 slot 无需上游改动，但芯片属于常驻统计，而不属于 composer 的控件。
- **把会话统计行从输入栏中抬出。** 否决：把该行渲染在 composer 链旁可以让它在任何 takeover 下都保留，但这会移动 ui-conversation 的 dock 及其间距规则，影响所有 dock 消费方，而且用户答题时还会显示 token pill，而 takeover 需要的只是 checkout；因此改由问题卡片声明自己的首席席位。
- **用 CSS 把芯片所在行拉到统计行带上。** 否决：这依赖 ui-chat 私有的行高，并会在窄宽度下与居中的 pill 相撞。
- **在 ui-chat 中增加占据 hook（`hooks: { seatOccupied }`）。** 暂不采纳：该行自身的 `:has` 收起已经回答了"什么会绘制"，而渲染为空的占据者——非仓库工作区——只有按绘制判断才能正确收起，按注册判断不能。

## 后果

- 可见页面为每个被监视 Session 每 15 秒最多启动三次 `git` 读取（detached HEAD 时四次）；隐藏页面一次也不启动，仓库之外的目录只启动一次。
- 统计行现在会为席位而挂载，并在 pill 与席位都不绘制时不占布局；有统计数字的 Session 保持原样，问题卡片头部在席位不绘制时也不保留任何行。
- composer takeover 期间 checkout 仍显示在问题卡片头部，而两个已挂载芯片共享一次监视，因此 takeover 不会带来额外的 git 读取。
- 终端 checkout 最多滞后一个轮询间隔；可见性刷新收敛了"回到浏览器"这一常见情形。
- remote URL 只被解析、不被信任：缺失、托管在其他站点或格式错误的 `origin` 会显示 ref 与 worktree 目录（除非该目录重复 GitHub 仓库名），但不显示链接。
- 该功能对模型不可见：prompt、schema 与 session 事件都不改变，KV cache 不受影响。
- 宿主服务刻意保留了未来状态界面的通用性，但目前只有这个 checkout 答案有消费者。
