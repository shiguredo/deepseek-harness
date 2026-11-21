# Agent Note: Per-instance durable state for concurrent Web servers

Status: implemented

[English](2026-10-12-web-instance-durable-state.md) | 中文

## Problem

一个 `dsh --profile web` 进程的所有 Session 都在同一个 JavaScript 线程上运行，因此需要更多独立容量的机器会在不同端口上、基于同一个 `$DSH_HOME` 运行多个服务器。共享同一个主目录会把 Session 列表汇成一份：`SessionController.list` 读取已配置根目录下的每个 Session，因此每个服务器都会显示其他服务器的 Session。它还会在持久 KV 存储上竞争：`storage-json` 在文档化的「每个进程只有一个写入者」假设下原子地发布 unit 文件，而 workspace、schedule 与 projection-cache 领域使用整文件布局，因此两个服务器可能相互覆盖对方的记录。

## Decision

`dsh --profile web --instance`（不接受名称）通过从显式的 `--port` 派生命名空间，为服务器绝不能共享的持久状态命名。`webStartup` 携带派生出的名称，Web bundle patch 覆盖 `session-persistence-jsonl` 与 `storage-json`，分别解析为 `dshInstancePath(ctx.webStartup.instance, 'sessions')` 与 `dshInstancePath(ctx.webStartup.instance, 'storages')`——即 `$DSH_HOME/instances/<port>/sessions` 与 `$DSH_HOME/instances/<port>/storages`。不传该 flag 时，`dshInstancePath` 的解析结果与 `dshHomePath` 完全相同，因此扁平的 `$DSH_HOME/sessions` 与 `$DSH_HOME/storages` 布局、以及所有现有部署都保持不变。该 flag 要求显式的非零 `--port`：不派生组合的默认端口是因为那样会搬迁现有的普通 `dsh --profile web` Session 存储，而由操作系统分配的 `--port 0` 不代表任何稳定的命名空间。

Profiles、credentials、settings 与 attachments 保持共享：它们不属于 Session 作用域，每个实例都应无需再次登录就能访问同一批模型，而 attachments 是内容寻址的。Desktop 组合使用同一个 bundle 且不传 `--instance`，因此保持共享布局。

## Alternatives considered

**从当时生效的端口（包括组合的默认端口）派生名称。** 只要给出 `--port` 就派生命名空间，会在没有迁移的情况下搬迁每一个现有 `dsh --profile web --port <n>` 部署的 Session 存储；而派生默认端口甚至会搬迁普通的 `dsh --profile web` 存储。要求显式的 flag 让这种搬迁成为一种选择。

**允许可选的 `--instance <name>` 与 `auto` 之类用于端口派生的哨兵值。** 选择派生的取值会把该名称从可用实例名中移除，因此名正言顺叫 `auto` 的实例就无法寻址。

**只拆分 `sessions`。** KV 存储正是 workspace、schedule 与 projection 记录所在之处，也是「每个进程只有一个写入者」假设被文档化之处，因此这样做会留下竞争。

**给每个服务器各自的 `DSH_HOME`。** 这会隔离一切，但会为每个服务器复制 profiles 与 credentials 并强制重新初始化 profile，而本应保持公共的用户数据恰恰不应被复制。

## Consequences

并发的服务器各自保留独立历史，且不再在 KV unit 文件上竞争。持久状态如今多了一种需要推理的布局；若运维人员在一组服务器中的某一台上省略 `--instance`，它仍保留旧的共享与竞争行为。全文 session 搜索由部署配置，该 flag 不会移动它；启用它的部署需要自行把其 SQLite `path` 放到实例命名空间下。

## Testing

`home-paths` 单元测试覆盖 `dshInstancePath` 的两个分支；app-boot 的 Loader 表达式测试证明该辅助函数可用于 `!!js`；`web-startup` 套件证明端口派生的 `--instance` 传递，以及对无端口或由操作系统分配端口的派生的拒绝。`dsh web --dump-config` 显示两条被 patch 的根路径。
