# Agent Note: 定时任务创建时的模型选择

Status: implemented

[English](2026-11-15-schedule-creation-model.md) | 中文

## 问题

创建 Session 的宿主任务此前使用宿主默认模型和 reasoning effort 运行该 Session。重复自动化往往需要比用户手工对话更便宜或更强的路由，而只有任务本身知道该用哪一条。模型工具与自动化任务页面都无法按任务指定该路由。

## 决定

会创建 Session 的投递目标在其创建值中携带可选的 `model`：provider id、provider 所有的 model id 和可选的 adapter 所有 reasoning effort。`schedule_create` 与 `schedule_edit` 接受 `provider`、`model` 和 `reasoning_effort`，自动化任务页面为声明推理等级的模型提供“模型”行和“推理等级”行。Host 在接受任务时通过 `ctx.llm.resolveCallConfig` 校验该路由，并在保存任何行之前以 `model_unavailable` 拒绝不可用的路由。

该路由与 `cwd`、`agentPreset` 一样属于创建值。`new_once` 或 `new` 目标创建的每个 Session 都会在投递指令之前用 `agent.model.select` 记录它，因此运行使用该路由。已存在的 `session` 目标保留其对话的模型，两个界面都拒绝对它做选择：在用户也会手动对话的会话中运行的提醒，不得在每次运行时改变该会话的路由。`new_once` 目标在首次投递后转为 `session`，此后模型保存在已创建的 Session 中，任务不再提供该行。

## 考虑过的替代方案

**在每次投递时应用任务级模型。** 已有对话会在每次运行时切换路由，把模型切换通知追加到其历史中，并让用户之后的手动回合留在自动化的路由上。它还会让任务成为 Session 自身选择之外的第二所有者。

**扩展 `session.create` 以接受模型。** 创建目标通过嵌入环境的创建提供方创建 Session，而预留的 `new_once` Session 可能已经由一次失败的投递创建，无需新的 create 调用。在解析出的 Agent 上记录选择可同时覆盖两条路径，并保持 Session API 不变。

**把选择应用为宿主默认值。** 后台任务会改变之后手动对话的默认路由。

## 影响

路由只在任务被接受时校验一次；之后消失的 provider、model 或 effort 会让需要它的那次投递失败，而任务仍然保留。`schedule` 领域保持版本 2，并能解码缺少该可选成员的行，因此已有任务不变。模型行只在目的地会创建 Session 时出现，选择宿主默认值会删除已保存的成员，而不是把当前默认值写成显式路由。`model_unavailable` 加入 Schedule 输入错误、两个工具的错误枚举以及页面的本地化拒绝。
