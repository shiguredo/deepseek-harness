# Agent Note: Web composer git-branch chip

Status: implemented

English | [中文](2026-09-15-web-composer-git-branch-chip.zh.md)

## Problem

The Web GUI named a Session's workspace directory but never the checkout that directory lived in. Worktree-heavy use made the path a poor identity: several checkouts of one repository differ only in their branch and directory, and a checkout in a terminal changes the branch without any Session event that could update the page. The harness had no reader for this fact at all — the build-time commit badge in the sidebar is build metadata, not workspace state — so a user reading a transcript could not tell which branch and worktree the agent's file edits were landing on, nor which GitHub repository the checkout was pushing to.

## Decision

Two plugins ship the feature. A Host Remote service answers the checkout for one Session workspace, and a browser chip renders it as the lead occupant of the composer's session-stats row; neither touches the session log, prompts, or tool schemas.

### The wire answer

[`dsh-api-workspace-git`](../../../../packages/api/workspace-git/README.md) owns the `workspaceGit` Remote namespace over the Session-scoped `workspaceGitScope` lookup — the same header-only resolution `dsh-api-workspace-files` uses, including the sandbox-policy fallback for a Session without `cwd`. The registration deliberately mirrors that resolution instead of extracting it: each sibling owns its Remote namespace and Typert descriptor, and neither package owns the other's service. `status(sessionId, signal)` returns one closed union:

```ts ignore-check
export type WorkspaceGitStatus =
  | { kind: 'branch'; name: string; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'detached'; head: string; worktree: string | null; github: WorkspaceGitGithub | null }
  | { kind: 'none' }
```

`none` is an answer, not an error: it covers a directory outside a repository, a host without git, a deleted workspace, and a deadline abort, because the chip has one rendering for all of them. The service runs git itself — `git -C <cwd> branch --show-current`, which names an unborn branch before its first commit and answers empty on a detached HEAD, then `rev-parse --short HEAD` when the answer was empty, plus `rev-parse --show-toplevel` for the worktree directory name and `config --get remote.origin.url` for the repository — through `ctx.subprocess`, so worktrees, submodules, and detached HEAD resolve exactly as git resolves them. The caller's signal is combined with the deployment's `timeoutMs`, which bounds both the spawn and the process range termination. The remote URL is parsed host-side in both spellings git stores, and only `github.com/owner/repo` yields a repository, because the chip's link must never guess a URL.

### The chip

[`dsh-client-ui-chat`](../../../../packages/client/ui-chat/README.md) declares one lead seat, `conversation.composer.stats.lead`, at the head of its session-stats row. The row mounts with the composer and collapses through `:has` while neither a pill nor the seat contributes content, so a seat occupant is not gated on the Session's first figures and a contentless row stays out of the layout. [`dsh-client-ui-user-questions`](../../../../packages/client/ui-user-questions/README.md) declares `conversation.question.header.lead` at the top of its question card, because the takeover hides the composer bar and the stats row with it; the header collapses the line through the same `:has` rule, so the takeover keeps no reserved band while no occupant paints.

[`dsh-client-ui-git-branch`](../../../../packages/client/ui-git-branch/README.md) registers the same chip into both seats and owns a page-lifetime controller. The chip reads `owner/repo:branch (worktree)` — dropping the parenthetical when the worktree directory repeats the repository name — or `owner/repo@abc1234 (worktree)` on a detached HEAD; a GitHub origin makes the whole chip a link opening `https://github.com/<owner>/<repo>` in a new tab, wearing the hover and focus affordances of the pills beside it, while a remote that names no GitHub repository leaves a plain reading. The chip calls `acquire(sessionId)` on mount and `release(sessionId)` on unmount; the controller counts the mounted chips per Session, so the hidden stats row and the takeover header share one watch, one 15-second interval, and one `visibilitychange` listener, which start with the first watch and stop with the last release. At most one read per Session is in flight, a poll during an in-flight read is skipped, and each settlement is fenced by a watch generation, so a fully released or re-acquired Session drops late answers. A failed read keeps the last published answer, and an unchanged answer publishes nothing, so the published snapshot's identity moves only when the checkout does.

## Testing

The Host package is covered by scripted-subprocess specs for the answer mapping, deadline abort, and argv shape, by a pure spec over the remote-URL spellings, and by real-git specs over temporary repositories for a branch, an unborn branch, a linked worktree, a detached HEAD, a bare repository without a worktree, a GitHub origin, a non-GitHub origin, and a directory outside every repository. The client package is covered by controller specs (poll cadence, visibility gating, in-flight skip, generation fencing, failed reads, publication only on change, one watch surviving until the last mounted chip releases it), chip specs (reading folding, the worktree omission when it repeats the repository name, plain and linked rendering, labels, watch lifecycle), and the HMR-safety spec that disposes the plugin fiber and observes both seat entries removed. The ui-chat stats spec proves the row holds for a seat occupant without figures, and the ui-user-questions composer and plan-review specs prove the question card renders the header lead seat above its heading and inside its review strip while the collapsed line reserves nothing. The Web snapshot suite stays keyless-replay safe because the assembled-remote defaults answer `workspaceGit/status` with `none` for the fixture directories, so the chip renders nothing there, and the question card's DOM is unchanged for a Session with no header occupant.

## Alternatives considered

- **A branch field on `SessionSummary`.** Rejected: it would put a live environment fact into durable Session-list data whose refresh follows Session changes rather than checkouts, and would add a git read to every list projection.
- **A `webServer` route pair like `dsh-host-open-in-app`.** Rejected: the Session-scoped Typert Remote already exists for exactly this data shape, and it brings the generated client, lookup-based Session resolution, and the `/api` trust fence without hand-written route policy.
- **Reading `.git/HEAD` through `workspaceFiles.read`.** Rejected: worktree `gitdir:` indirection, detached HEAD, and packed refs make the file format the wrong authority; the workflow already requires the git binary.
- **Watching `.git/HEAD` instead of polling.** Rejected for now: the filesystem seam has no OS watch, a watcher per Session buys only seconds over the visibility-triggered poll, and polling is the only trigger that also catches a branch the agent changes mid-turn.
- **Dirty and ahead/behind state.** Rejected: `git status` cost scales with the working tree, which a poll-driven chip cannot afford; the chip answers the checkout question only.
- **Host-side caching.** Rejected: a cached answer is stale exactly when a polling caller wants it fresh, and the process cost of these reads is small.
- **Putting the chip in the Session header.** Rejected: the header hides on a blank Session, while the composer carries the input the checkout describes, beside the stats it belongs with.
- **The chip's own `conversation.composer.dock` row.** Rejected: the dock stacks full-width rows, so a second row floats the chip above the stats rather than on their line, and merging the rows by measurement would reach into another plugin's layout.
- **The composer tool row (`conversation.input.left`).** Rejected: the existing slot needs no upstream change, but the chip belongs with the ambient stats, not with the composer's controls.
- **Lifting the session-stats row out of the input bar.** Rejected: rendering the row beside the composer chain would keep it under every takeover, but it relocates ui-conversation's dock and its clearance rules for every dock consumer, and it shows the token pills while the user answers a question when the takeover needs only the checkout; the question card declares its own lead seat instead.
- **Pulling the chip's row onto the stats band with CSS.** Rejected: it depends on ui-chat's private row height and collides with the centered pills at narrow widths.
- **An occupancy hook in ui-chat (`hooks: { seatOccupied }`).** Rejected for now: the row's own `:has` collapse already answers what paints, and an occupant that renders nothing — a non-repository workspace — collapses correctly only through paint, not through registration.

## Consequences

- A visible page spawns up to three `git` reads per watched Session per 15 seconds (four on a detached HEAD); a hidden page spawns none, and a directory outside a repository spawns one.
- The stats row now mounts for the seat's sake and leaves the layout while neither a pill nor the seat paints; a Session with figures is unchanged, and the question card's header reserves no line while its seat paints nothing.
- A composer takeover keeps the checkout visible from the question card's header, and the two mounted chips share one watch, so the takeover buys no extra git read.
- A terminal checkout can lag by up to one interval; the visibility refresh bounds the common case of returning to the browser.
- A remote URL is parsed, never trusted: an absent, differently hosted, or malformed `origin` shows the ref, the worktree directory (unless it repeats a GitHub repository name), and no link.
- The feature is model-invisible: no prompt, schema, or session event changes, and the KV cache is unaffected.
- The Host service is deliberately general enough for a future status surface, but only this checkout answer has a consumer today.
