---
description: "Commit confirmation guard that asks the user before an agent runs a commit-creating Git command, with one default for new Sessions and one switch per Session, for users and maintainers choosing, configuring, or debugging the plugin."
kind: "package-reference"
---

# @deepseek-ai/dsh-git-commit-guard

English | [中文](README.zh.md)

## Summary

This package keeps an agent from creating a Git commit on its own. While the guard is enabled for a Session, a commit-creating Git command (`git commit`, `merge`, `rebase`, `cherry-pick`, `revert`, `am`, `commit-tree`) run through the tool pipeline waits until the user confirms it in the Web UI. The question names the exact command: **Allow** runs that one command, and **Reject** blocks it with a model-visible reason. Two independent settings drive the decision — one default for new Sessions and one choice per Session. No repository hook is added.

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

Mount this plugin in a Web or Desktop composition: it needs the browser UI for the confirmation question, so a profile without a connected Web client cannot approve a commit and the guard fails closed. The shipped Web bundle runs it. The composer chip switches one Session and the built-in settings card sets the default for new Sessions; the plugin registers no slash command.

### When to choose it

Choose it while an agent works in a repository whose commit history must stay under human control. Skip it for unattended runs — CI, headless automation, or a Session nobody is watching — because a commit there stays blocked with no one to answer the question.

### Settings

| Setting | Default | Meaning |
|---|---|---|
| `stateFile` | `$DSH_HOME/commit-guard/state.json` | Absolute path of the persisted setting file |
| `defaultEnabled` | `true` | Whether a Session starts guarded when it has no stored choice |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-git-commit-guard) documents every accepted value.

### What the user controls

The composer **Commit guard ON / OFF** chip changes the Session it sits in; a later default change never reaches a Session that already made its choice. The Shiguredo built-in plugin settings card changes the default for new Sessions, and the `defaultEnabled` configuration seeds that value before any browser writes it. Both levels live in the same `stateFile` and write no session message. An approval is per attempt: the next commit asks again.

### What the agent sees

A blocked commit never runs. The agent reads the denial as an ordinary tool error: `Git commit guard: the user rejected this commit, so nothing ran. Do not retry unless the user asks you to commit.` When no human answer is reachable — no connected Web client, a headless composition, or a subagent that cannot open a human interaction — the call fails closed with the matching reason instead of executing.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers one `tools/pre-execute` listener, one exact Web route, one `agent/created` observer, and one system-prompt section. It requires the `webServer`, `connection`, `tools`, `systemPrompt`, and `userQuestions` services.

### Interception and confirmation

The listener recognizes a commit-creating Git subcommand in `bash` and `terminal_send` calls: it skips environment assignments and Git global options (`-C`, `-c`, `--git-dir`, …), looks through wrappers (`sudo`, `env`, `sh -c`, `eval`, …), and inspects every shell segment. Recognition is a convenience, not a sandbox: a command hidden inside a script the agent writes is not detected. A recognized call whose Session guard is on calls `userQuestions.ask()` with one structured question that carries the exact command in its detail; `Allow` delegates to the next pre-execute listener, everything else returns a denial. Cancellation returns `cancel`, and a failure to ask returns a denial rather than running the command.

### Two independent settings

`stateFile` holds `{ "default": boolean, "sessions": { "<sessionId>": boolean } }`. A Session without a stored choice captures the current default on first use, so changing the default never overrides an existing Session. The Web route serves reads and writes for both levels and calls the `connection` service's `requestRejection` fence before answering, so the Host/Origin and authentication checks owned by Connection gate the browser control. Both settings are separate from the Session's permission preset and approval policy.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: listener, question, route, prompt section, state wiring |
| [`src/commit-command.ts`](src/commit-command.ts) | Shell-command recognition of commit-creating Git subcommands |
| [`src/state.ts`](src/state.ts) | Durable default and per-Session choices with capture-on-first-use |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Tools subsystem reference](../../../docs/subsystems/tools.md) — the pre-execute pipeline and its decisions.
- [Approval subsystem reference](../../../docs/subsystems/approval.md) — the adjacent human-decision seam this plugin composes with instead of replacing.
- [User questions](../../interaction/user-questions/README.md) — the question/answer seam used for the confirmation.

-----

<a id="model-experience"></a>
## Model Experience

### Commit guard policy section

#### What the model sees

While the addressed Session's guard is on, each assembled request contains the section below. A Session with the guard off contributes nothing.

##### Session policy section

```markdown
Git commit guard is enabled in this session: commit-creating Git commands (git commit, merge, rebase, cherry-pick, revert, am, commit-tree) do not run until the user answers the confirmation question the Harness shows right before the command runs. If the user rejects it, do not retry unless the user asks you to commit. The user can turn the guard off for this session from the guard chip in the composer.
```

#### Token effect

A fixed paragraph per request while the addressed Session is guarded; no tokens for a Session with the guard off.

#### KV Cache effect

Independent of retained history. Toggling the addressed Session's guard replaces this section in the next assembly and can invalidate reuse from that point; an unchanged setting preserves the existing prefix.

### Refused commit

#### What the model sees

A refused call fails with one of the denial messages below as its tool error, and the command's own output never appears. The confirmation question itself is answered in the user UI and is not model context.

##### Rejection message

```markdown
Git commit guard: the user rejected this commit, so nothing ran. Do not retry unless the user asks you to commit.
```

##### Unreachable-answerer message

```markdown
Git commit guard: the user could not be asked to confirm this commit, so nothing ran.
```

#### Token effect

One bounded tool-error message on refusal, and no added tokens when the call executes.

#### KV Cache effect

Append-only: the refusal is part of retained tool history and does not rewrite the reusable request prefix.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when the guard is a poor fit. They are current package constraints, not a task backlog.

- **Commands are recognized, not intercepted consistently** — a commit inside a script, a make target, or an obfuscated command is not seen; the guard reduces accidents and is not a sandbox.
- **Confirmation needs a live Web page** — headless compositions and subagents cannot answer, so a guarded commit there stays blocked; unattended deployments should keep the guard off.
- **The default reaches only Sessions without a stored choice** — an existing Session keeps its own value forever, and there is no bulk apply; change the default from the built-in plugins settings card or the `defaultEnabled` configuration.
- **The route is an in-process Web concern** — Desktop and other carriers must provide `webServer` and `connection`; a composition without both does not activate the plugin.
- **Only the two shell tools are inspected** — a future tool that can create commits must be added to this listener explicitly.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
