---
kind: upgrade-guide
description: "内置提交守卫变为新包名下的 Git 推送守卫，状态文件与 Windows 命令覆盖随之改变。"
---

# 内置提交守卫变为 Git 推送守卫

[English](guide.md) | 中文

## 变更

`@deepseek-ai/dsh-git-commit-guard` 与 `@deepseek-ai/dsh-client-ui-git-commit-guard` 被 `@deepseek-ai/dsh-git-push-guard` 与 `@deepseek-ai/dsh-client-ui-git-push-guard` 取代。守卫现在在 `git push` 前询问，而不是在创建提交的 Git 命令前询问，并检查 `bash`、`pwsh` 与 `terminal_send` 工具；旧包不检查 `pwsh`，因此在随附的 Windows 组合中从不询问。提交、合并、变基以及 `gh pr merge` 不再询问。

持久化设置从 `$DSH_HOME/commit-guard/state.json` 迁移到 `$DSH_HOME/push-guard/state.json`；旧选择不会被读取，因为它们描述的是另一种操作。浏览器路由从 `/commit-guard/state` 迁移到 `/push-guard/state`，Web 组合包的行 id 现在是 `git-push-guard` 与 `ui-git-push-guard`。

在 profile patch 或 `cordis.yml` 中指名旧包、或依赖旧提交确认的人会观察到该变更。只使用随附 Web 组合包行的 profile 无需修改。

## 迁移

1. 在 profile patch、`cordis.yml` 或 overlay 中指名 `@deepseek-ai/dsh-git-commit-guard` 或 `@deepseek-ai/dsh-client-ui-git-commit-guard` 的位置，把行改为 `@deepseek-ai/dsh-git-push-guard` 与 `@deepseek-ai/dsh-client-ui-git-push-guard`；把行 id `git-commit-guard` 与 `ui-git-commit-guard` 改为 `git-push-guard` 与 `ui-git-push-guard`。
2. 删除 `$DSH_HOME/commit-guard/state.json` 或将其留作未使用；通过内置插件设置卡片或 `defaultEnabled` 配置设置新的默认值，它会写入 `$DSH_HOME/push-guard/state.json`。
3. 如果部署需要提交审查，请在其自身的审批策略或指令文件中表达；守卫不再在提交前询问。
4. 使用已连接的 Web 客户端确认：智能体的 `git push` 会请求确认，`git commit` 不经守卫提问直接执行，且 `GET /push-guard/state` 在 Web 源上应答。
