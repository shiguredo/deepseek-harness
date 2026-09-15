---
description: "Font-family plugin for the web GUI: the durable font preference, its pre-plugin bootstrap, and the General settings Font row that applies one family to UI text and code."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-font-family

English | [中文](README.zh.md)

## Summary

This package owns the user's font-family preference end to end: a durable `fontFamily` field on the plugin's own Host entry (`ui-font-family`), the browser form binding, the two body variables that carry the chosen family, a pre-plugin bootstrap row, and the General settings Font row that edits it. With no stored family the plugin writes nothing and the shipped theme stacks stay untouched; the row applies exactly the family the user names, to UI text and code alike. Disabling the plugin removes the row and the durable field without changing any shipped stack.

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

Mount this plugin in a web composition that carries the configuration-form projection (`ui-settings`), the locale registry, and the slot registry; the web-app bundle mounts it beside `ui-theme`. The profile needs no configuration: the durable `fontFamily` value is edited through the settings row.

### What to expect

The General settings section gains one Font row: a single-line input holding a CSS font-family list, committed on Enter or blur. The committed list is validated (trimmed, at most 256 characters, no `;`, `{}`, or control characters), persisted in the plugin's `ui-font-family` Host entry, and written to `--dsw-font-family` and `--ds-font-family-code` on the document body, so one choice covers UI text and code. Emptying the field clears the durable value and retracts both tokens, returning the document to the shipped theme stacks; text the validation rejects stays in the field, marked invalid, for correction. When a family is stored, the index bootstrap embeds it, so the first paint after a reload already carries it before any client plugin activates.

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

### Host half

`apply` declares the plugin's `Config` — the volatile `fontFamily` field over `FontSettingsFields` — keeps this instance off the generated Settings pages, and answers every `webserver/index-inject` collection with one body script when the live family is set. No stored family adds no row, so the shipped theme stacks stay the default.

### Browser half

`apply` resolves `ctx.configForms.get('ui-font-family')`, the shared form for this plugin's own Host entry, and one effect subscribes to it: while the first section is still loading nothing is written (a bootstrap value, when one exists, stands untouched), and after that each accepted section writes the chosen family or retracts both variables. The same effect's disposer retracts both variables, returning the document to the shipped theme stacks. A second effect registers the `settings.font` dictionaries, and the Font row registers into `settings.general.item` (order 12, id `font-family`) with a revision-guarded store mirroring the form; the injected face normalizes before writing, so invalid text never reaches the wire.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the row or the tokens are not enough; they move from this setting to the theme it overrides and the settings transport it writes through.

- [dsh-client-ui-theme](../ui-theme/README.md) — the theme registry and the Appearance and font-size rows sharing the General section.
- [dsh-client-ui-layout](../ui-layout/README.md) — the presenter that owns the palette and typography tokens on the document.
- [dsh-client-ui-settings](../ui-settings/README.md) — the configuration-form projection, schema validation, and the General item seat.
- [Web styling](../../../docs/web-styling.md) — styling ownership and the token layers this setting overrides.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is browser chrome over a user-interface preference and registers no prompt, schema, or session event.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what the setting owns and what it deliberately leaves alone.

- **One family for text and code** — a proportional family also makes code proportional; per-surface families would need two fields and two rows.
- **Process-local pages keep the shipped stacks** — when the settings transport stays memory-only (a non-loopback page without host persistence), the row still edits but nothing is written and no variable is applied, matching the configuration form's own write contract.
- **No per-language or per-script stacks** — the row overrides both tokens with the listener the user names; a Japanese-first deployment stores its preferred family instead of relying on a shipped default.
- **The shipped stacks stay the default** — the plugin never rewrites the theme's typography; with no stored family nothing is written at all.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The plugin owns one Config field, one index-injection contribution, one form subscription, one slot entry, and one dictionary effect, each disposed with its fiber; the form snapshot is the only cross-render state and the body variables are its pure projection.
