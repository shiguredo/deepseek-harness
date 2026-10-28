# Agent Note: Git push guard as a built-in plugin

Status: implemented

English | [中文](2026-10-26-git-push-guard.zh.md)

## Problem

A push moves an agent's work off the machine and into shared history, where other people build on it and a force-push can replace commits a user did not mean to lose. A commit stays local: the user can amend, squash, or reset it before anything leaves. Feedback on the [commit guard](2026-10-24-git-commit-guard.md) asked for the confirmation at the push, because that is the point where work becomes shared.

The commit guard also did nothing on Windows. The shipped Windows composition runs the `pwsh` tool, while the guard inspected only `bash` and `terminal_send`, and its recognition was written for POSIX command forms. An agent's `git.exe push`, a full Windows path, the PowerShell `&` call operator, a `pwsh -Command` payload, a `cmd /c` wrapper, and a `$env:NAME=` prefix all reached Git without a question, so the guard could not be relied on there.

## Decision

Ship `@deepseek-ai/dsh-git-push-guard` (Host) and `@deepseek-ai/dsh-client-ui-git-push-guard` (browser) in the Web bundle, replacing `@deepseek-ai/dsh-git-commit-guard` and `@deepseek-ai/dsh-client-ui-git-commit-guard`. The Host plugin watches `tools/pre-execute` for `git push` in `bash`, `pwsh`, and `terminal_send` calls. When the addressed Session's guard is on, it asks one structured `userQuestions` question that names the exact command; `Allow` delegates to the next listener, every other outcome returns a model-visible denial, and a failed ask or an aborted call fails closed. No token, expiry, or pre-approval state exists.

Recognition follows the ways an agent reaches Git through those three tools: `git push` after global options (`git -C repo push`), through the wrappers `sudo`, `env`, `command`, `builtin`, `nohup`, `time`, `exec`, `xargs`, and `start`, through a nested command string (`sh -c`, `pwsh -Command`, `powershell`, `cmd /c`) or `eval`, and in the Windows and PowerShell forms `git.exe`, an executable named by a full or quoted Windows path, the `&` call operator, and `$env:NAME=` assignments. Every shell segment is inspected, so a push after `&&`, `;`, or a pipe is recognized. Recognition is a convenience, not a sandbox: a push inside a script the agent writes, or behind a shell alias or function, is not detected.

Two settings are deliberately separate. `stateFile` holds `{ default, sessions }` at `$DSH_HOME/push-guard/state.json`: `defaultEnabled` sets the default for Sessions created from then on, and the composer chip changes one Session. A Session without a stored choice captures the current default on first use, so changing the default never overrides an existing Session. The shipped browser surfaces are the composer chip and a card in the Shiguredo built-in plugin settings group of the Plugins page. The browser package adds no sidebar entry; the card writes the same state route, and `defaultEnabled` seeds the value before any browser write. Both levels are served by one same-origin `GET|POST /push-guard/state` route; the route calls the `connection` service's `requestRejection` check before answering, so Connection's Host/Origin and authentication checks protect the control.

The plugin adds no Git hooks and installs nothing in a repository. It inspects only those three tools.

## Alternatives considered

- **Keep the commit guard.** Feedback asked for the confirmation at the push, and the commit guard cannot be reached on the Windows composition because it does not inspect `pwsh`. Keeping it would confirm an action the user can still undo locally while leaving the shared step unguarded.
- **Guard both commits and pushes.** Two questions per change, and the commit question duplicates what the Session's approval policy or instruction files already cover. A deployment that wants each commit reviewed keeps that policy; the built-in guard stays on the step that publishes work.
- **A Git hook (prek, lefthook, or a plain pre-push hook) as the enforcement point.** A hook catches pushes hidden in scripts, but it needs repository-local configuration, conflicts with the repository's own hook manager, and cannot show the user the exact pending command in the Harness UI; an early version of this guard built and removed one. The tool-layer guard remains the supported surface.
- **Approval-seam `ask` decision with expiring tokens.** The first profile-local version used a one-shot token with a ten-minute expiry. Tokens quietly admitted later pushes, and under the `never` approval policy the pipeline's `ask` could not reach a human at all. Per-attempt questions with no stored approval replace both and make each decision auditable in the transcript as a tool outcome.
- **One profile-wide switch only.** Simplest, but it cannot express "this Session only" and a change in one place silently rewrites every Session's posture. The default/per-Session split keeps the global answer while letting one Session opt out without a bulk apply.
- **A dedicated slash command for toggling.** Every command writes `command/run` and `command/done` into the Session transcript, which turns a preference change into conversation content; the Web route keeps the control out of the transcript.
- **A sidebar page for the default setting.** A built-in plugin must not add navigation clutter to every profile, so the default stays in the Shiguredo built-in plugin settings group of the Plugins page and the composer chip covers one Session.
- **Deriving the setting from session events or a projection.** The toggle is not a user message and the plugin cannot append a new event type; a projection would have required a synthetic event. A small owned state file keeps the choice durable without widening the Session format.

## Consequences

- The confirmation needs a connected Web answerer. Headless compositions, a closed page, and subagents cannot answer, so a guarded push there stays blocked; the README tells unattended deployments to keep the guard off.
- The Web bundle runs the guard by default, so a fresh profile asks before the first agent push. Deployments that do not want it remove the row or set `defaultEnabled` to false; the guard still needs a `webServer` and a `connection` service and does not activate without them.
- The built-in settings card is the default-setting UI; an operator can still seed or override it through the `defaultEnabled` configuration, and a user can opt one Session out from the composer chip.
- An agent can commit without asking and the user reviews the push instead. A deployment that wants commit control states it in its approval policy or instruction files.
- Recognition covers three tools and the common wrapper and PowerShell forms; a push hidden in a script, alias, or function, one started through `Start-Process` or an `-EncodedCommand` payload, and `gh pr merge` all pass unasked.
- The setting change itself is not recorded in the Session transcript. A later reader cannot reconstruct who changed the guard; the denial and the question answer remain the auditable artifacts.
- The package names are externally visible: a profile or `cordis.yml` that names the old packages must switch to the new ones.
- Package tests cover the guard, including a real-composition Loader test that boots a `cordis.yml` with real tool, agent, and prompt rows; the client tests cover the browser surfaces.

## Testing

`packages/guard/git-push-guard/tests` exercises the state route (reads, both write levels, the connection refusal, malformed requests), the pre-execute decision paths (allow, reject, unreachable answerer, child agent, no agent, cancellation), push recognition including the Windows and PowerShell forms, and the state file (capture on first use, malformed input). `loader-composition.spec.ts` boots a real `cordis.yml` through the vendored Loader with the real Session, agent, system-prompt, tools, and native-executor rows plus the guard row, fakes only the Web carrier and the human answerer, and asserts a rejected push blocked before dispatch with the model-visible denial, an allowed push that runs, an untouched `git commit` and `git merge`, the guarded `pwsh` `& "C:\…\git.exe" push` form, both state levels read and written and persisted, and the policy section present in an assembled request only while the Session guard is on. `packages/client/ui-git-push-guard/tests` covers the plugin registration, the composer chip, and the built-in settings card with a stubbed route. The browser surfaces have no recorded-session snapshot, so the client suite is their only automated evidence.
