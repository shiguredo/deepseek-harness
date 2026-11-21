# Agent Note: Git 推送守卫作为内置插件

Status: implemented

[English](2026-10-26-git-push-guard.md) | 中文

## 问题

推送会把智能体的工作移出本机、写进共享历史，其他人会在此基础上继续工作，而强制推送可能替换掉用户并不想丢失的提交。提交仍留在本地：在内容离开本机之前，用户可以用 amend、squash 或 reset 处理它。针对[提交守卫](2026-10-24-git-commit-guard.zh.md)的反馈要求把确认放在推送处，因为那才是工作变成共享内容的时刻。

提交守卫在 Windows 上也毫无作用。随附的 Windows 组合运行 `pwsh` 工具，而守卫只检查 `bash` 与 `terminal_send`，其识别逻辑也是按 POSIX 命令形式写的。智能体的 `git.exe push`、完整 Windows 路径、PowerShell 的 `&` 调用运算符、`pwsh -Command` 载荷、`cmd /c` 包装以及 `$env:NAME=` 前缀都会不经提问直接到达 Git，因此在那里无法依赖该守卫。

## 决定

在 Web bundle 中发布 `@deepseek-ai/dsh-git-push-guard`（Host）与 `@deepseek-ai/dsh-client-ui-git-push-guard`（浏览器），取代 `@deepseek-ai/dsh-git-commit-guard` 与 `@deepseek-ai/dsh-client-ui-git-commit-guard`。Host 插件在 `bash`、`pwsh` 与 `terminal_send` 调用中检查 `tools/pre-execute` 里的 `git push`。当目标会话的守卫开启时，它通过一次结构化的 `userQuestions` 提问点名确切命令；选择 `Allow` 会交给下一个监听器，其他任何结果都返回模型可见的拒绝，提问失败或调用被取消则失败关闭。不存在令牌、过期时间或预先批准状态。

识别覆盖智能体通过这三个工具触达 Git 的常见方式：带全局选项的 `git push`（`git -C repo push`），经 `sudo`、`env`、`command`、`builtin`、`nohup`、`time`、`exec`、`xargs` 与 `start` 等包装的命令，通过嵌套命令字符串（`sh -c`、`pwsh -Command`、`powershell`、`cmd /c`）或 `eval`，以及 `git.exe`、以完整路径或带引号 Windows 路径给出的可执行文件、`&` 调用运算符与 `$env:NAME=` 赋值这些 Windows 与 PowerShell 形式。每个 shell 片段都会被检查，因此 `&&`、`;` 或管道之后的推送也能识别。识别只是便利，不是沙箱：智能体写进脚本里的推送，或藏在 shell 别名、函数之后的推送不会被检测到。

两个设置被刻意分开。`stateFile` 在 `$DSH_HOME/push-guard/state.json` 保存 `{ default, sessions }`：`defaultEnabled` 设置此后创建的新会话的默认值，输入框芯片修改单个会话。没有存储选择的会话在首次使用时捕获当前默认值，因此修改默认值不会覆盖已有会话。已发布的浏览器界面是输入框芯片与插件页面中“时雨堂内置插件设置”分组的卡片。浏览器包不添加侧边栏条目；卡片写入同一状态路由，`defaultEnabled` 在任何浏览器写入之前提供初始值。两个层级都由同一个同源 `GET|POST /push-guard/state` 路由提供；路由在回答前调用 `connection` 服务的 `requestRejection` 检查，由 Connection 的 Host/Origin 与身份验证检查保护控制面。

该插件不添加 Git 钩子，也不在仓库中安装任何内容。它只检查这三个工具。

## 考虑过的替代方案

- **保留提交守卫。** 反馈要求在推送处确认，而提交守卫不检查 `pwsh`，在 Windows 组合上根本无法触达。保留它只会确认一个用户仍可在本地撤销的动作，却让共享那一步失去守卫。
- **同时守卫提交与推送。** 每次改动要问两次，而且提交问题与会话审批策略或指令文件已经覆盖的内容重复。希望每次提交都经过审查的部署保留该策略即可；内置守卫留在发布工作的那一步。
- **以 Git 钩子（prek、lefthook 或普通 pre-push 钩子）作为执行点。** 钩子能拦截脚本中的推送，但需要仓库本地配置，会与仓库自身的钩子管理器冲突，也无法在 Harness 界面里向用户显示确切待执行的命令；该守卫的早期版本实现并移除了一个。工具层守卫仍是受支持的界面。
- **审批接缝的 `ask` 决定加过期令牌。** 最初的 profile 本地版本使用十分钟过期的一次性令牌。令牌会悄悄放行之后的推送，而在 `never` 审批策略下，管线的 `ask` 根本无法触达用户。每次尝试都提问且不存储批准，取代了两者，并让每次决定作为工具结果在会话记录中可审计。
- **仅使用一个 profile 级开关。** 最简单，但无法表达“仅此会话”，一处修改会静默改写所有会话的态势。默认值与每会话的拆分保留了全局答案，同时允许单个会话退出而无需批量应用。
- **专用斜杠命令用于切换。** 每个命令都会向会话记录写入 `command/run` 与 `command/done`，把偏好修改变成对话内容；Web 路由让控制不进入会话记录。
- **用于默认值设置的侧边栏页面。** 内置插件不应给每个 profile 增加导航负担，因此默认值留在插件页面的“时雨堂内置插件设置”分组，输入框芯片覆盖单个会话。
- **从会话事件或投影推导设置。** 切换不是用户消息，插件也无法追加新的事件类型；投影将需要合成事件。由插件拥有的小状态文件让选择持久化，而无需扩大会话格式。

## 影响

- 确认需要已连接的 Web 回答方。无头组合、已关闭的页面与子智能体无法回答，因此那里的受守卫推送会一直阻断；README 告知无人值守部署保持守卫关闭。
- Web bundle 默认运行该守卫，因此新 profile 在第一次智能体推送前会询问。不需要它的部署可以移除该行或把 `defaultEnabled` 设为 false；守卫仍需要 `webServer` 与 `connection` 服务，缺少时不会激活。
- 内置插件设置卡片就是默认值设置界面；运维人员仍可通过 `defaultEnabled` 配置提供或覆盖它，用户也可从输入框芯片让单个会话退出。
- 智能体可以不询问就提交，由用户改为审查推送。希望控制提交的部署在其审批策略或指令文件中说明。
- 识别覆盖三个工具以及常见的包装与 PowerShell 形式；藏在脚本、别名或函数里的推送、经 `Start-Process` 或 `-EncodedCommand` 载荷启动的推送，以及 `gh pr merge` 都不会被询问。
- 设置变更本身不记录在会话记录中。之后的读者无法重建是谁修改了守卫；拒绝结果与问题回答仍是可审计的产物。
- 包名对外可见：引用旧包名的 profile 或 `cordis.yml` 必须改为新名称。
- 包测试覆盖该守卫，其中包括启动真实工具、agent 与提示词行的 `cordis.yml` 的真实组合 Loader 测试；客户端测试覆盖浏览器界面。

## 测试

`packages/guard/git-push-guard/tests` 覆盖状态路由（读取、两个写入层级、连接拒绝、畸形请求）、pre-execute 决策路径（允许、拒绝、无法触达回答方、子智能体、无智能体、取消）、包含 Windows 与 PowerShell 形式的推送识别，以及状态文件（首次使用时捕获、畸形输入）。`loader-composition.spec.ts` 通过 vendored Loader 启动真实 `cordis.yml`，使用真实的 Session、agent、system-prompt、tools 与 native-executor 行加上守卫行，只把 Web 载体与人工回答方作为假件，断言被拒绝的推送在执行前被阻断并返回模型可见的拒绝、允许的推送会执行、`git commit` 与 `git merge` 原样通过、`pwsh` 的 `& "C:\…\git.exe" push` 形式受守卫、状态路由读写并持久化两个层级的值，以及组装请求只在会话守卫开启时包含推送策略段落。`packages/client/ui-git-push-guard/tests` 用打桩的路由覆盖插件注册、输入框芯片与内置设置卡片。浏览器界面没有录制的会话快照，因此客户端测试是它们唯一的自动化证据。
