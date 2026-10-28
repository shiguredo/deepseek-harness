# Agent Note: Web composer git-branch chip

Status: implemented

English | [中文](2026-09-15-web-composer-git-branch-chip.zh.md)

## Problem

The Web GUI named a Session's workspace directory but never the checkout that directory lived in. Worktree-heavy use made the path a poor identity: several checkouts of one repository differ only in their branch and directory, and a checkout in a terminal changes the branch without any Session event that could update the page. The harness had no reader for this fact at all — the build-time commit badge in the sidebar is build metadata, not workspace state — so a user reading a transcript could not tell which branch and worktree the agent's file edits were landing on, nor which GitHub repository the checkout was pushing to.

## Decision

Two plugins ship the feature. A Host Remote service answers the checkout for one Session workspace, and a browser chip renders it as the lead occupant of the composer session-stats block's first row; neither touches the session log, prompts, or tool schemas.

### The wire answer

[`dsh-api-workspace-git`](../../../../packages/api/workspace-git/README.md) owns the `workspaceGit` Remote namespace over the Session-scoped `workspaceGitScope` lookup — the same header-only resolution `dsh-api-workspace-files` uses, including the sandbox-policy fallback for a Session without `cwd`. The registration deliberately mirrors that resolution instead of extracting it: each sibling owns its Remote namespace and Typert descriptor, and neither package owns the other's service. The resolution reads a live Session's projected `workingDirectory`, not its immutable header `cwd`: a Session that enters a linked worktree mid-conversation reports that checkout, while a cold Session, whose events are not loaded, still answers from the persisted header. `status(sessionId, signal)` returns one closed union:

```ts ignore-check
export type WorkspaceGitStatus =
  | { kind: 'branch'; name: string; root: string | null; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'detached'; head: string; root: string | null; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'none' }
```

`none` is an answer, not an error: it covers a directory outside a repository, a host without git, a deleted workspace, and a deadline abort, because the chip has one rendering for all of them. The service runs git itself — `git -C <cwd> branch --show-current`, which names an unborn branch before its first commit and answers empty on a detached HEAD, then `rev-parse --short HEAD` when the answer was empty, plus one `rev-parse --show-toplevel --absolute-git-dir --path-format=absolute --git-common-dir` for the checkout root path and the worktree name, and `config --get remote.origin.url` for the repository — through `ctx.subprocess`, so worktrees, submodules, and detached HEAD resolve exactly as git resolves them. The rev-parse answer carries three lines: the root path is always reported, and its base name is reported as the worktree name only when the private git directory differs from the common directory, which is exactly what a linked worktree does; the main worktree reports the path alone. The caller's signal is combined with the deployment's `timeoutMs`, which bounds both the spawn and the process range termination. The remote URL is parsed host-side in both spellings git stores, and only `github.com/owner/repo` yields a repository, because the chip must never guess a URL.

### The chip

[`dsh-client-ui-chat`](../../../../packages/client/ui-chat/README.md) declares one lead seat, `conversation.composer.stats.lead`, at the head of its session-stats block's first row, with the figure pills on the second. The block mounts with the composer and collapses through `:has` while neither a pill nor the seat contributes content, so a seat occupant is not gated on the Session's first figures and a contentless block stays out of the layout. [`dsh-client-ui-user-questions`](../../../../packages/client/ui-user-questions/README.md) declares `conversation.question.header.lead` at the top of its question card, because the takeover hides the composer bar and the stats block with it; the header collapses the line through the same `:has` rule, so the takeover keeps no reserved band while no occupant paints.

[`dsh-client-ui-git-branch`](../../../../packages/client/ui-git-branch/README.md) registers the same chip into both seats and owns a page-lifetime controller. The trigger reads `owner/repo:branch` — or `owner/repo@abc1234` on a detached HEAD — followed by the checkout root path, appending the worktree name in parentheses only when the workspace is a linked worktree. Clicking opens a trigger-anchored dialog with one row per fact: the branch or commit, the worktree name when linked, the root path, and the GitHub repository URL as text — no row navigates, because the checkout answer is a reading, not a link, and the cache-hit and step pills beside it open their own dialogs the same way. The chip calls `acquire(sessionId)` on mount and `release(sessionId)` on unmount; the controller counts the mounted chips per Session, so the hidden stats block and the takeover header share one watch, one 15-second interval, and one `visibilitychange` listener, which start with the first watch and stop with the last release. At most one read per Session is in flight, a poll during an in-flight read is skipped, and each settlement is fenced by a watch generation, so a fully released or re-acquired Session drops late answers. A failed read keeps the last published answer, and an unchanged answer publishes nothing, so the published snapshot's identity moves only when the checkout does. The chip also reads the client-visible `workingDirectory` projection and re-reads its checkout when that directory changes, so a Session that enters a linked checkout through the worktree tool updates at once instead of waiting for the poll; the working-directory domain exposes the key through a pure-type `client` outlet (`@deepseek-ai/dsh-working-directory/client`) so the client program never loads the service's host graph.

## Testing

The Host package is covered by scripted-subprocess specs for the answer mapping, deadline abort, and argv shape, by a pure spec over the remote-URL spellings, and by real-git specs over temporary repositories for a branch, an unborn branch, a linked worktree, a detached HEAD, a bare repository without a worktree, a GitHub origin, a non-GitHub origin, and a directory outside every repository. The client package is covered by controller specs (poll cadence, visibility gating, in-flight skip, generation fencing, failed reads, publication only on change, one watch surviving until the last mounted chip releases it), chip specs (reading folding, the checkout root path for the main worktree and the name for a linked one, the trigger, the detail dialog's rows, labels, Escape and outside-pointer close, watch lifecycle), and the HMR-safety spec that disposes the plugin fiber and observes both seat entries removed. The ui-chat stats spec proves the block holds for a seat occupant without figures and groups the figure pills on their own row, and the ui-user-questions composer and plan-review specs prove the question card renders the header lead seat above its heading and inside its review strip while the collapsed line reserves nothing. The Web snapshot suite stays keyless-replay safe because the assembled-remote defaults answer `workspaceGit/status` with `none` for the fixture directories, so the chip renders nothing there, and the question card's DOM is unchanged for a Session with no header occupant.

## Alternatives considered

- **A branch field on `SessionSummary`.** Rejected: it would put a live environment fact into durable Session-list data whose refresh follows Session changes rather than checkouts, and would add a git read to every list projection.
- **A `webServer` route pair like `dsh-host-open-in-app`.** Rejected: the Session-scoped Typert Remote already exists for exactly this data shape, and it brings the generated client, lookup-based Session resolution, and the `/api` trust fence without hand-written route policy.
- **Reading `.git/HEAD` through `workspaceFiles.read`.** Rejected: worktree `gitdir:` indirection, detached HEAD, and packed refs make the file format the wrong authority; the workflow already requires the git binary.
- **Watching `.git/HEAD` instead of polling.** Rejected for now: the filesystem seam has no OS watch, a watcher per Session buys only seconds over the visibility-triggered poll, and polling is the only trigger that also catches a branch the agent changes mid-turn.
- **Dirty and ahead/behind state.** Rejected: `git status` cost scales with the working tree, which a poll-driven chip cannot afford; the chip answers the checkout question only.
- **Host-side caching.** Rejected: a cached answer is stale exactly when a polling caller wants it fresh, and the process cost of these reads is small.
- **Putting the chip in the Session header.** Rejected: the header hides on a blank Session, while the composer carries the input the checkout describes, beside the stats it belongs with.
- **The chip's own `conversation.composer.dock` row.** Rejected: the dock stacks full-width entries, so a second dock row floats the chip above the stats rather than grouping with them; the chip keeps the stats block's lead seat and the block carries it on its own first row instead.
- **A GitHub link on the chip.** Rejected after the first implementation: a click that leaves the page competes with the ambient reading, and the pills beside the chip open detail dialogs rather than navigating, so the checkout facts moved into a dialog and the repository URL became a row of text.
- **The composer tool row (`conversation.input.left`).** Rejected: the existing slot needs no upstream change, but the chip belongs with the ambient stats, not with the composer's controls.
- **Lifting the session-stats row out of the input bar.** Rejected: rendering the row beside the composer chain would keep it under every takeover, but it relocates ui-conversation's dock and its clearance rules for every dock consumer, and it shows the token pills while the user answers a question when the takeover needs only the checkout; the question card declares its own lead seat instead.
- **Pulling the chip's row onto the stats band with CSS.** Rejected: it depends on ui-chat's private row height and collides with the centered pills at narrow widths.
- **An occupancy hook in ui-chat (`hooks: { seatOccupied }`).** Rejected for now: the row's own `:has` collapse already answers what paints, and an occupant that renders nothing — a non-repository workspace — collapses correctly only through paint, not through registration.

## Consequences

- A visible page spawns up to three `git` reads per watched Session per 15 seconds (four on a detached HEAD); a hidden page spawns none, and a directory outside a repository spawns one.
- The stats block now mounts for the seat's sake and leaves the layout while neither a pill nor the seat paints; a Session with figures keeps its pills on the second row, and the question card's header reserves no line while its seat paints nothing.
- A composer takeover keeps the checkout visible from the question card's header, and the two mounted chips share one watch, so the takeover buys no extra git read.
- A terminal checkout can lag by up to one interval; the visibility refresh bounds the common case of returning to the browser.
- A remote URL is parsed, never trusted: an absent, differently hosted, or malformed `origin` leaves the repository row at its placeholder while the ref and the checkout path still show.
- The chip names the worktree only for a linked worktree; the main checkout reports its root path and no worktree name, because its directory is the repository root.
- The feature is model-invisible: no prompt, schema, or session event changes, and the KV cache is unaffected.
- The Host service is deliberately general enough for a future status surface, but only this checkout answer has a consumer today.
