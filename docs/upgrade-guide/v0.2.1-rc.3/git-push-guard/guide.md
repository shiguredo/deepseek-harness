---
kind: upgrade-guide
description: "The built-in commit guard becomes a Git push guard under new package names, with a new state file and Windows command coverage."
---

# The built-in commit guard becomes the Git push guard

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-git-commit-guard` and `@deepseek-ai/dsh-client-ui-git-commit-guard` are replaced by `@deepseek-ai/dsh-git-push-guard` and `@deepseek-ai/dsh-client-ui-git-push-guard`. The guard now asks before a `git push` instead of before commit-creating Git commands, and it inspects the `bash`, `pwsh`, and `terminal_send` tools; the previous package ignored `pwsh`, so it never asked on the shipped Windows composition. Commits, merges, rebases, and `gh pr merge` no longer ask.

Persisted settings moved from `$DSH_HOME/commit-guard/state.json` to `$DSH_HOME/push-guard/state.json`; the old choices are not read because they described a different operation. The browser route moved from `/commit-guard/state` to `/push-guard/state`, and the Web bundle rows are now `git-push-guard` and `ui-git-push-guard`.

Anyone who names the old packages in a profile patch or `cordis.yml`, or who relies on the old commit confirmation, observes the break. A profile that only uses the shipped Web bundle rows needs no change.

## Migration

1. Where a profile patch, `cordis.yml`, or overlay names `@deepseek-ai/dsh-git-commit-guard` or `@deepseek-ai/dsh-client-ui-git-commit-guard`, rename them to `@deepseek-ai/dsh-git-push-guard` and `@deepseek-ai/dsh-client-ui-git-push-guard`, and rename the row ids `git-commit-guard` and `ui-git-commit-guard` to `git-push-guard` and `ui-git-push-guard`.
2. Delete `$DSH_HOME/commit-guard/state.json` or leave it unused; set the new default with the built-in plugins settings card or the `defaultEnabled` configuration, which writes `$DSH_HOME/push-guard/state.json`.
3. If a deployment needs commit review, express it in its own approval policy or instruction files; the guard no longer asks before commits.
4. Confirm with a connected Web client that the agent's `git push` asks for confirmation, that `git commit` runs without the guard's question, and that `GET /push-guard/state` answers on the Web origin.
