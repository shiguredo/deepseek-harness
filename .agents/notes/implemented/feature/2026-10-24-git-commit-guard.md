# Agent Note: Git commit guard as a built-in plugin

Status: implemented

English | [中文](2026-10-24-git-commit-guard.zh.md)

## Problem

An agent that runs `git commit` on its own puts work into history the user did not approve. Tool restrictions, prompt instructions, and approval policies do not name commits specifically: a deployment can allow every shell command while still wanting one confirmation before history changes. The guard also has to answer two questions that conflict when collapsed into one switch: what should a new Session do, and what should an existing Session do after the user changes their mind.

The same capability was first built as a local profile bundle with a one-shot token and a global toggle. That design drifted in use: an expiring token allowed commits after the user had changed their mind, a global flag could not express one Session opting out, and a fixed default of "on" could not be turned off for unattended runs without editing profile state.

## Decision

Ship `@deepseek-ai/dsh-git-commit-guard` (Host) and `@deepseek-ai/dsh-client-ui-git-commit-guard` (browser) in the Web bundle. The Host plugin watches `tools/pre-execute` for commit-creating Git subcommands in `bash` and `terminal_send` calls. When the addressed Session's guard is on, it asks one structured `userQuestions` question that names the exact command; `Allow` delegates to the next listener, every other outcome returns a model-visible denial, and a failed ask or an aborted call fails closed. No token, expiry, or pre-approval state exists.

Two settings are deliberately separate. `stateFile` holds `{ default, sessions }`: `defaultEnabled` sets the default for Sessions created from then on, and the composer chip changes one Session. A Session without a stored choice captures the current default on first use, so changing the default never overrides an existing Session. The shipped browser surfaces are the composer chip and a card in the Shiguredo built-in plugin settings group of the Plugins page. The package adds no sidebar entry; the card writes the same state route, and `defaultEnabled` seeds the value before any browser write. Both levels are served by one same-origin `GET|POST /commit-guard/state` route; the route calls the `connection` service's `requestRejection` fence before answering, so Connection's Host/Origin and authentication checks protect the control.

The plugin adds no Git hooks and installs nothing in a repository. Shell recognition is explicitly a convenience, not a sandbox: a commit hidden in a script the agent writes is not detected, and the README states that limit.

## Alternatives considered

- **Approval-seam `ask` decision with expiring tokens.** The first profile-local version used a one-shot token with a ten-minute expiry. Tokens quietly admitted later commits, and under the `never` approval policy the pipeline's `ask` could not reach a human at all. Per-attempt questions with no stored approval replace both and make each decision auditable in the transcript as a tool outcome.
- **A Git hook (prek, lefthook, or a plain pre-commit hook) as the enforcement point.** A hook catches commits hidden in scripts, but it needs repository-local configuration, conflicts with the repository's own hook manager, and cannot show the user the exact pending command. It was built, verified, and then removed from the shipped feature; the tool-layer guard remains the supported surface.
- **One profile-wide switch only.** Simplest, but it cannot express "this Session only" and a change in one place silently rewrites every Session's posture. The default/per-Session split keeps the global answer while letting one Session opt out without a bulk apply.
- **A dedicated slash command for toggling.** The Host design started with `/commit-guard on|off`. Every command writes `command/run` and `command/done` into the Session transcript, which turned a preference change into conversation content; the Web route keeps the control out of the transcript.
- **A sidebar page for the default setting.** The profile-local version shipped a left-pane page plus a keyed main panel. A built-in plugin must not add navigation clutter to every profile, so the shipped package puts the default in its own Shiguredo built-in plugin settings group of the Plugins page and keeps the composer chip for one Session.
- **Deriving the setting from session events or a projection.** The toggle is not a user message and the plugin cannot append a new event type; a projection would have required a synthetic event. A small owned state file keeps the choice durable without widening the Session format.

## Consequences

- The confirmation needs a connected Web answerer. Headless compositions, a closed page, and subagents cannot answer, so a guarded commit there stays blocked; the README tells unattended deployments to keep the guard off.
- The Web bundle now runs the guard by default, so a fresh profile asks before the first agent commit. Deployments that do not want it remove the row or set `defaultEnabled` to false; the guard still needs a `webServer` and a `connection` service and does not activate without them.
- The built-in settings card is the default-setting UI; an operator can still seed or override it through the `defaultEnabled` configuration, and a user can opt one Session out from the composer chip.
- Shell recognition covers the two shipped shell tools and the common wrapper forms; a future tool that can create a commit must be added explicitly, recorded as a package README limitation.
- The setting change itself is not recorded in the Session transcript. A later reader cannot reconstruct who changed the guard; the denial and the question answer remain the auditable artifacts.
- Package tests cover the route, the listener, the state capture, and the client components. The real-composition Loader test and the recorded-session snapshot for the browser surfaces remain open; they are the next verification step before this feature is considered release-ready.

## Testing

`packages/guard/git-commit-guard/tests` exercises the route (reads, both write levels, trust fence, malformed requests), the pre-execute decision paths (allow, reject, unreachable answerer, child agent, no agent, cancellation), the state file (capture on first use, malformed input), and the prompt section. `packages/client/ui-git-commit-guard/tests` covers the plugin registration and the composer chip with a stubbed route. Repository gates run in the change: typecheck, lint, package README gates, translation pairing, config catalog, and dependency policy.
