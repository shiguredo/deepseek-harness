---
description: "Japanese (ja) language pack for the dsh web GUI: the ja language definition and one typed dictionary per shipped namespace over the locale registry."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-locale-ja

English | [中文](README.zh.md)

## Summary

`dsh-client-locale-ja` adds Japanese to the web GUI's language selector. The browser half registers the `ja` language definition and a Japanese dictionary for every namespace the shipped client registers, so the whole interface switches to Japanese without a reload; the node half is empty and exists only so the plugin is a Loader entry. Dictionaries the pack does not carry fall back to English through the language's declared chain. Removing the pack's roster row drops Japanese from the selector and returns an active `ja` selection to the available locale.

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

Open Settings → General → Language and select 日本語. The UI copy switches immediately and the choice persists like the shipped Chinese and English selections. Nothing needs configuration: the web-app bundle mounts the pack, and `<html lang>` follows the active locale (`ja`). A browser whose own language is Japanese selects it on first visit.

To drop Japanese, remove the `locale-ja` row from the web-app bundle's roster; the pack's contributions are disposed with the plugin fiber.

### Updating a translation

Every dictionary lives in `src/client/dicts/<namespace>.ts` and is declared as `LocaleDictOf<'<namespace>'>` with a type-only import of the owning package. A missing or extra key is a compile error, so an upstream key rename fails this package's build until the translation follows. A namespace the registry gains later surfaces in English until this pack ships a dictionary for it.

## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The pack is additive: it never edits the locale registry or another feature package.

### Registration

`apply` registers the language definition through `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })` and every dictionary through the per-locale `ctx.locale.register(ns, 'ja', dict)` form, all as owned effects in one fiber. Disposal removes exactly these contributions. The registry appends `ja` after the shipped `zh`/`en` pair, which fixes its position in the selector. Dictionaries may register before or after the language definition; the runtime resolves them by namespace.

### Dictionary typing

`LocaleDictOf<N>` resolves the exact key union an owning package merged into `LocaleNamespaceMap`, so each dictionary is complete by construction. The type-only import loads the declaring module: the owner's dictionary module when it carries the `LocaleNamespaceMap` declaration itself, otherwise the owner's client entry that loads it (several owners declare it beside the registry, not beside the dictionary). A namespace whose owner declares no key union — `directory-browser` — is registered with the per-locale form and typed as `Record<string, string>`.

### Source map

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Language definition and dictionary registration effects |
| [`src/client/dicts/`](src/client/dicts/) | One Japanese dictionary per namespace plus the sorted registry list |
| [`src/index.ts`](src/index.ts) | Node half: empty apply so the Loader can mount the row |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [locale](../locale/README.md) — the registry this pack extends and the language-pack contract it implements.
- [ui-theme](../ui-theme/README.md) — the General settings rows the pack translates.
- [Client group map](../README.md) — the browser half this package belongs to.

-----

<a id="model-experience"></a>
## Model Experience

None, as the language pack is a browser-side UI layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define what the pack does not own and where upstream movement lands.

- **Upstream key changes stop the build, upstream additions do not** — a renamed or removed key fails typechecking here, while a namespace added upstream falls back to English until a dictionary is added.
- **Language packs own language-specific behavior** — the registry supplies selection, persistence, browser matching, key fallback, and `<html lang>`; the pack carries no plural rules, bidirectional layout, or locale-aware formatting.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The pack's relationship to the registry is registration/disposal behavior asserted by its apply spec; there is no independent runtime source to compare against.
