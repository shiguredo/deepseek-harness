# Agent Note: Per-instance durable state for concurrent Web servers

Status: implemented

English | [中文](2026-10-12-web-instance-durable-state.zh.md)

## Problem

One `dsh --profile web` process runs every Session on one JavaScript thread, so a machine needing more independent capacity runs several servers on different ports over one `$DSH_HOME`. Sharing the home pools the Session listing: `SessionController.list` reads every Session under the configured root, so each server shows every other server's Sessions. It also races the durable KV store: `storage-json` publishes a unit file atomically under a documented one-writer-per-process assumption, and the workspace, schedule, and projection-cache domains use the whole-file layout, so two servers can overwrite each other's records.

## Decision

`dsh --profile web --instance`, which takes no name, namespaces the durable state a server must not share by deriving the namespace from the explicit `--port`. `webStartup` carries the derived name, and the web bundle patch overrides `session-persistence-jsonl` and `storage-json` to resolve `dshInstancePath(ctx.webStartup.instance, 'sessions')` and `dshInstancePath(ctx.webStartup.instance, 'storages')` — `$DSH_HOME/instances/<port>/sessions` and `$DSH_HOME/instances/<port>/storages`. Without the flag `dshInstancePath` resolves exactly like `dshHomePath`, so the flat `$DSH_HOME/sessions` and `$DSH_HOME/storages` layout, and every existing deployment, is unchanged. The flag requires an explicit nonzero `--port`: the composed default port is not derived because doing so would relocate an existing plain `dsh --profile web` Session store, and the OS-assigned `--port 0` names nothing stable.

Profiles, credentials, settings, and attachments stay shared: they are not Session-scoped, every instance should reach the same models without another sign-in, and attachments are content-addressed. Desktop compositions use the same bundle and pass no `--instance`, so they keep the shared layout.

## Alternatives considered

**Derive a name from whichever port is in effect, including the composed default.** Deriving the namespace whenever `--port` is present would move the Session store of an existing `dsh --profile web --port <n>` deployment without a migration, and deriving the default would move even a plain `dsh --profile web` store. Requiring the flag keeps that relocation a choice.

**Accept an optional `--instance <name>` with a sentinel such as `auto` for port derivation.** A value that selects derivation removes that name from the usable instance names, so an instance legitimately named `auto` becomes unaddressable.

**Split only `sessions`.** The KV store is where the workspace, schedule, and projection records live and where the one-writer-per-process assumption is documented, so this leaves the race.

**Give each server its own `DSH_HOME`.** This isolates everything but duplicates profiles and credentials per server and forces profile re-initialization, while the user data that should stay common is exactly what should not be duplicated.

## Consequences

Concurrent servers keep separate histories and no longer contend on KV unit files. Durable state now has a second layout to reason about, and an operator who omits `--instance` on one of several servers keeps the old sharing and racing behavior. Full-text session search is deployment-configured and the flag does not move it; a deployment enabling it places its SQLite `path` under the instance namespace itself.

## Testing

`home-paths` unit tests pin both branches of `dshInstancePath`; the app-boot Loader-expression test proves the helper is available to `!!js`; the `web-startup` suite proves port-derived `--instance` propagation and the refusal of a portless or OS-assigned derivation. `dsh web --dump-config` shows the two patched roots.
