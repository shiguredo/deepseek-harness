# Agent Note: Schedule creation model selection

Status: implemented

English | [中文](2026-11-15-schedule-creation-model.zh.md)

## Problem

A Host task that creates a Session ran that Session on the Host default model and reasoning effort. A recurring automation often needs a cheaper or stronger route than the user's manual conversations, and the task is the only place that knows which. The model tools and the Automation tasks page had no way to name that route per task.

## Decision

A creating delivery target carries an optional `model` in its creation values: a provider id, a provider-owned model id, and an optional adapter-owned reasoning effort. `schedule_create` and `schedule_edit` accept `provider`, `model`, and `reasoning_effort`, and the Automation tasks page offers a Model row plus a Reasoning effort row for models that advertise reasoning levels. The Host validates the route with `ctx.llm.resolveCallConfig` when it accepts the task and refuses an unusable route with `model_unavailable`, before any row is stored.

The route is a creation value like `cwd` and `agentPreset`. Each Session that a `new_once` or `new` target creates records it with `agent.model.select` before the delivered instruction, so the run uses it. An existing `session` target keeps the model of its conversation and both surfaces refuse a selection for it: a reminder that runs in a conversation the user also chats in must not change that conversation's route on every run. A `new_once` target converts to `session` after its first delivery, so the model then lives in the created Session and the task no longer offers the row.

## Alternatives considered

**A task-level model applied on every delivery.** An existing conversation would switch routes on each run, append model-switch notices to its history, and leave the user's later manual turns on the automation's route. It would also make the task a second owner beside the Session's own selection.

**Extending `session.create` with a model.** The creation target creates Sessions through the embedding's creation provider, and a reserved `new_once` Session can already exist from a failed delivery without a fresh create call. Recording the selection on the resolved Agent covers both paths and leaves the Session API unchanged.

**Applying the selection as the Host default.** A background task would change the default route of later manual conversations.

## Consequences

The route is validated once, when the task is accepted; a provider, model, or effort that disappears later fails the delivery that needs it while the task stays stored. The `schedule` domain keeps version 2 and decodes rows without the optional member, so existing tasks are unchanged. The model rows appear only while the destination creates Sessions, and choosing the Host default removes the stored member instead of writing the current default as an explicit route. `model_unavailable` joins the Schedule input errors, both tool error enums, and the page's localized refusal.
