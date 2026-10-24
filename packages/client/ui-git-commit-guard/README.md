---
description: "Composer chip that switches one Session's Git commit guard and built-in settings card that sets the guard default for new Sessions, for users and maintainers composing the built-in guard."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-git-commit-guard

English | [中文](README.zh.md)

## Summary

This package is the browser half of the Git commit guard. It contributes two surfaces: a composer chip that shows and switches the addressed Session's guard, and a card in the **Shiguredo built-in plugin settings** group of the Plugins page that sets the default for new Sessions. Both read and write the Host package's same-origin `GET|POST /commit-guard/state` route; the Host owns persistence, enforcement, and the confirmation question. Neither surface writes a Session message, and the package ships no sidebar page.

## Table of Contents

- [Use this package](#use-this-package)
- [What to expect](#what-to-expect)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin beside [`@deepseek-ai/dsh-git-commit-guard`](../../guard/git-commit-guard/README.md), which registers `/commit-guard/state` and owns the guard, beside [`dsh-client-ui-conversation`](../ui-conversation/README.md) for the `conversation.input.left` seat, and beside [`dsh-client-ui-plugin-manager`](../ui-plugin-manager/README.md) for the `plugins.item` seat. The plugin takes no configuration. The chip appears in the composer tool row of every Session and addresses that Session only; the settings card appears among the built-in plugin settings.

<a id="what-to-expect"></a>
## What to expect

The chip shows “Commit guard ON” or “Commit guard OFF” beside a small lock glyph, and “Loading…” until the first read settles. It stays disabled while the read or a write is in flight. Clicking it posts `{ enabled, sessionId }` and changes only that Session; the default for new Sessions is unchanged. Its tooltip names the current setting and says that the new-Session default is unchanged. The chip re-reads on mount, on window focus, and on `visibilitychange`, so a change written by another client appears when this client next gains focus or its tab becomes visible. A read or write failure tints the chip as an error and moves the localized failure text into its tooltip, leaving the last known label in place.

The Shiguredo built-in plugin settings card shows the default for new Sessions with an On/Off control. It reads the bare route when its page opens and posts `{ enabled }` when the user chooses a value. A read or write failure shows the localized failure line in place. The card carries a one-line summary in the settings list; its hint says that changes affect new Sessions only and that an existing Session switches from the composer chip.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

`apply` registers one typed dictionary namespace and two slot contributions: `conversation.input.left` with id `git-commit-guard` and order 40 (the chip), and `plugins.item` with id `git-commit-guard` and order 60 (the built-in settings card, whose label follows the locale). Each registration declares the `gitCommitGuard` locale namespace, so the renderer supplies the `t` seat, and both inject one route face built once in `apply` — `loadState`/`saveState` closed over the Host's route URL. That shared identity keeps the components' mount effects from re-fetching on every render. The route helpers live in the plugin (`src/client/state.ts`), not a service import; they validate the JSON answer (a non-object body, a missing boolean field, or a non-2xx status rejects) and surface failures as each surface's quiet error state. Components hold only local state — the loaded setting, an in-flight flag, and a failed flag. Dictionary registration and both slot contributions are effects of the plugin fiber, so unloading the plugin removes the chip, the card, and their copy together.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-git-commit-guard`](../../guard/git-commit-guard/README.md) — the Host guard, its state route, and the confirmation question.
- [dsh-client-ui-conversation](../ui-conversation/README.md) — declares `conversation.input.left`, the chip's composer seat.
- [dsh-client-ui-plugin-manager](../ui-plugin-manager/README.md) — owns the Plugins page and the `plugins.item` settings seat.
- [dsh-client-locale](../locale/README.md) — the dictionary registry and language selection this plugin's copy follows.
- [Slots reference](../../../docs/subsystems/slots.md) — how a plugin registers into another plugin's declared slot.
- [Web client architecture](../../../docs/subsystems/web-client.md) — how browser plugin rows load and register slots.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package presents browser chrome that writes the guard state over the Host's HTTP route and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request. The Host guard package owns the guard's model-visible prompt section.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define the shipped surfaces and what they deliberately do not do.

- **The state route is the only interface** — both surfaces fail to load unless the Host package provides `/commit-guard/state`; a missing route leaves them in their inline failure states rather than hiding them.
- **The settings card is not a profile switch** — it changes the default for Sessions created later; an existing Session keeps its own value, and a profile composition change can still override the default through `defaultEnabled`.
- **No Session message by design** — switching a Session's setting or the default persists only the route state; the transcript records neither the change nor its author, so replay cannot explain a later guard decision on its own.
- **Another client's change is eventually visible** — the chip re-reads on mount, focus, and visibility change, not on a live push, so a change made elsewhere can stay unseen until the next focus or mount.
- **The chip does not create Sessions or Host agents** — it requires the standard `sessionId` of the composer it renders in, and fails closed before that seat supplies one.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
