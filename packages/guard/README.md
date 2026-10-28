---
description: "Package map for the loop-hygiene guard family: the advisory repeat-tool reminder, the per-tool-call timeout policy, and the push confirmation guard, for users and maintainers choosing or composing the guards."
kind: "package-group"
---

# guard/ — loop-hygiene guard family

English | [中文](README.zh.md)

## Summary

The `guard/` group keeps the agent loop productive. `repeat-tool-reminder` notices repeated identical tool calls and reminds the model to change approach or finish. `timeout-policy` bounds tool calls that declare a limit, so a hung call returns a clear error. `git-push-guard` asks the user to confirm a `git push` before the agent runs it, with one default for new Sessions and one switch per Session. The first two ship enabled in the `dsh` base bundle; the push guard ships in the Web bundle. A composition can tune or remove them.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

Three small plugins cover these behaviors; each README below explains when to keep, tune, or remove it.

| Package | What it provides |
|---|---|
| [`repeat-tool-reminder/`](repeat-tool-reminder/README.md) | Reminds the model when it repeats the same tool call, so it changes approach or finishes |
| [`timeout-policy/`](timeout-policy/README.md) | Times out tool calls that declare a limit, so the model gets a clear error instead of waiting forever |
| [`git-push-guard/`](git-push-guard/README.md) | Asks the user to confirm a `git push` before the agent runs it, with a default for new Sessions and one switch per Session |

-----

<a id="related-documentation"></a>
## Related documentation

Start with the tools subsystem reference for the tool-call pipeline, then the push guard's decision record, the reminder's configuration, and the timeout-library decision behind the policy.

- [Tools subsystem reference](../../docs/subsystems/tools.md) — the tool-call pipeline and decisions the guards build on.
- [Generated configuration catalog](../../docs/config-catalog.md#deepseek-aidsh-repeat-tool-reminder) — every accepted field of the repeat-call reminder.
- [Push guard Agent Note](../../.agents/notes/implemented/feature/2026-10-26-git-push-guard.md) — why the guard confirms pushes, and what it cannot see.
- [Timeout deadline library Agent Note](../../.agents/notes/implemented/architecture/2026-07-06-timeout-deadline-library.md) — the timing/termination split `timeout-policy` enforces.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
