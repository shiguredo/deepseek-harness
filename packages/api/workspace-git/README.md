---
description: "Workspace git service for the web GUI: the checkout the session workspace directory lives in — ref, worktree directory, and GitHub repository — exposed over the workspaceGit Remote namespace."
kind: "package-reference"
---

# @deepseek-ai/dsh-api-workspace-git

English | [中文](README.zh.md)

## Summary

This package answers one host question for the web GUI: which checkout does the current Session workspace live in. The `workspaceGit` Remote namespace resolves a Session header's directory without activating an Agent, runs `git` reads through the subprocess provider, and maps them onto a three-case union — a branch name, a short commit id when HEAD is detached, or `none` outside a repository. Both found cases also carry the worktree directory name and, when `origin` addresses github.com, its `owner/repo` and repository URL. It is ambient environment information, not session state: it never enters the session log or a model request.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the plugin in a composition that carries `sessions`, `subprocess`, `sandboxPolicy`, and `typert`, normally beside its browser consumer [`dsh-client-ui-git-branch`](../../client/ui-git-branch/README.md). A Client calls `remote.workspaceGit.status(sessionId, signal)`.

### Configuration

| Field | Default | Meaning |
|---|---|---|
| `timeoutMs` | required | Deadline in milliseconds for one `git` invocation, from executable resolution through the exit fact. |

### What to expect

One answer names a checked-out branch, including an unborn branch before its first commit; one names the short commit id of a detached HEAD; `none` stands for a directory outside a repository, a host without git, a workspace that is gone, and an invocation that timed out. A directory nested inside a repository reports the containing repository. The worktree directory name is the base name of the checkout's root, so a linked worktree reports the directory the Session actually works in; a repository without a working tree (a bare repository) has none. The GitHub repository is read from `origin` only, and only when that URL addresses github.com, so an unreachable or differently hosted remote leaves it null while the ref answer stands. None of these is an error: an unavailable fact is an answer. Every call spawns `git -C <workspaceRoot> branch --show-current`, then `git rev-parse --show-toplevel` and `git config --get remote.origin.url` — a fourth `git rev-parse --short HEAD` when HEAD is detached, and nothing but the first read outside a repository — with no caching, so a caller that polls owns its interval.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Session-scoped lookup `workspaceGitScope` resolves a Session id to its workspace directory exactly as `dsh-api-workspace-files` resolves `workspaceFileScope`: the live header's `cwd`, else the persisted header for a cold Session, else the sandbox policy's workspace root; a Session with no header at all resolves to `undefined`, which the Gateway reports as `gateway/lookup-not-found`. Every read combines the caller's signal with the deployment deadline and passes the combined signal to its spawn, so a timeout aborts the managed process range through the subprocess provider's ordinary termination procedure. stdout and stderr are collected under a 64 KiB cap — each answer is one line — and a non-zero exit, an unresolvable `git`, a rejected spawn, and an aborted deadline all read as an unavailable fact. `branch --show-current` carries all three ref cases: a name for a branch or an unborn branch, an empty answer for a detached HEAD that the follow-up short-id read resolves, and a failure outside a repository. The remote URL is parsed in both spellings git stores, scheme URLs (`https://`, `ssh://`, `git://`) and scp-like `[user@]host:path`, and a URL naming anything but `github.com/owner/repo` yields no repository.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the service's own view is not enough; they move from the wire union to its consumer and the seams it builds on.

- [dsh-client-ui-git-branch](../../client/ui-git-branch/README.md) — the composer stats-row chip that polls this namespace.
- [dsh-api-workspace-files](../workspace-files/README.md) — the sibling Session-scoped lookup this service follows.
- [dsh-subprocess](../../subprocess/subprocess/README.md) — the process capability that owns spawn, termination, and output collection.
- [API Gateway](../../../docs/api-gateway.md) — how a generated Remote namespace becomes a Client call.

-----

<a id="model-experience"></a>
## Model Experience

None, as the service reads working-directory facts for browser chrome and never reaches a prompt, a tool schema, or a session event.

#### KV Cache effect

None; the service neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what the service answers and what it deliberately does not.

- **No working-tree state** — only the ref, the worktree directory name, and the origin repository are read; dirty, staged, and ahead/behind facts need a heavier git read that polling cannot afford.
- **GitHub links only** — a remote on another host, a fork's `upstream`, and a remote named other than `origin` are all invisible; the answer carries no repository then.
- **No caching** — every call spawns git, because a cached answer goes stale exactly when a caller polls to learn it changed; a deployment that wants less process churn must poll less.
- **No branch list or switch** — the service reads the current ref only.
- **`git` is required on the host** — a host without git answers `none` for every workspace instead of failing loudly; the feature simply never appears.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The service owns no durable or cross-plugin state — each answer derives from the Session header and its child processes, and its lookup registration lives and ends inside its own construction.
