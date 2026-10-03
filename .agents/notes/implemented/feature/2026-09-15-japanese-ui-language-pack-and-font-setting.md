# Agent Note: Japanese UI support — ja language pack and font-family plugin

Status: implemented

English | [中文](2026-09-15-japanese-ui-language-pack-and-font-setting.zh.md)

## Problem

The Web client ships Chinese and English only, and the language selector offers no third choice. The shipped font stacks pin Chinese CJK families (`'PingFang SC'`, `'Hiragino Sans GB'`, `'Microsoft YaHei'`) ahead of any other CJK family, so Japanese text renders with Chinese glyph variants on every platform, and no user control exists for choosing a font. A Japanese-first deployment needs the locale, correct Japanese glyph selection, and a way to name a specific family.

## Decision

Japanese ships as a language pack, not as a third built-in locale. `@deepseek-ai/dsh-client-locale-ja` (`packages/client/locale-ja`) activates in the web-app bundle roster and registers `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })` plus one Japanese dictionary for each shipped namespace through the per-locale `register(ns, 'ja', dict)` form. Each dictionary is declared as `LocaleDictOf<'ns'>` with a type-only import of the owning package, so a missing, extra, or renamed key fails the build; a namespace the pack does not carry falls back to English at runtime through the declared chain.

The font behavior ships in its own plugin, `@deepseek-ai/dsh-client-ui-font-family` (`packages/client/ui-font-family`). It declares the plugin's own `Config` — the volatile `fontFamily` field of the `ui-font-family` Host entry — and owns the two body variables `--dsw-font-family` and `--ds-font-family-code`. The plugin writes nothing while the entry holds no family, so the shipped theme stacks stay the default; a stored family is written to both variables, and the plugin's index bootstrap embeds it so the first paint after a reload already carries the user's choice.

The plugin registers the Font row into the General settings section: a free-form CSS font-family list that commits on Enter or blur, keeps text the normalization rejects inline for correction, and clears the field back to the shipped stacks when emptied. The injected face normalizes (trim, 256-character cap, no `;`, `{}`, or control characters) before writing through `ctx.configForms.get('ui-font-family')`; each accepted section writes the chosen family or retracts both variables, and disposing the plugin retracts them too.

New `settings.font` copy (`fontFamily.title`, `fontFamily.description`, `fontFamily.placeholder`) ships in the plugin's zh/en dictionaries and in the pack's Japanese dictionary.

## Alternatives considered

- **First-class `ja` in `LOCALE_IDS`.** The typed `register(ns, { zh, en, ja })` form would force a Japanese dictionary into every package's registration and make every upstream string change a conflict surface in this fork. Language packs are the documented mechanism for languages outside the shipped pair; rejected.
- **Partial pack coverage first.** A partly translated UI presents two languages at once in one screen; the pack ships complete coverage of the current namespaces, with English fallback covering later upstream additions; rejected.
- **A preset font list (Hiragino Sans, Noto Sans JP, Yu Gothic, …).** Presets encode per-platform font availability and still miss locally installed families; a validated free-form list covers every platform; rejected.
- **Body text font only.** Japanese also appears in code blocks and terminal output, where the code token governs; writing both tokens keeps one choice coherent; rejected.
- **Pinning Japanese families in the default stack.** Adding `'Hiragino Sans'` before the Chinese families would fix Japanese at the cost of Chinese glyph selection on a Japanese-first stack, and browser defaults already follow the page language for both; rejected in favor of the explicit setting alone, which leaves the shipped stacks untouched when unused.
- **Shipping locale-neutral default stacks in the plugin.** An earlier cut of the plugin wrote its own `system-ui` / Latin default stacks whenever no family was stored; rejected because a feature plugin would hardcode a product-wide typography default, while the shipped theme stacks already own that choice and the row is the only thing the user asked to control.
- **Keeping the font setting inside ui-theme.** The setting began as an optional `fontFamily` field on the theme namespace with its row, snapshot, presenter wiring, and boot injection in `ui-theme`/`ui-layout`; rejected because the fork's font customization then lives in three upstream packages, while a dedicated plugin keeps them untouched and makes the whole behavior removable per profile.

## Consequences

- The ja pack adds a language, not a font: with no stored family the shipped (CJK-pinned) stacks still rule, so a Japanese-first deployment stores its preferred family in the row.
- Font-stack completeness is compile-time enforced for every namespace the pack covers; an upstream key rename breaks the pack build until translated, which is the intended maintenance pressure for this fork, while runtime never blanks a key because English terminates the chain.
- The pack is additive: an upstream sync conflicts in the dictionary modules only where keys changed, never in the owner packages.
- A user-specified family applies to UI text and code alike; a proportional family therefore makes code proportional until the field is cleared.
- The font plugin is additive too: upstream theme packages carry no font-setting code, and disabling the plugin removes the row and the durable field together while no shipped stack is rewritten.
- The Font row participates in the plugin's own revision-guarded store over the shared configuration form, and its durable value is validated by the plugin's Config schema.

## Testing

Unit coverage: `font-settings.client.spec.ts` (normalization and limits), `config.host.spec.ts` (Config validation, page omission, and the conditional bootstrap rows), `apply.client.spec.ts` (form binding, variable application and retraction, the loading fence, row registration and face writes, and teardown), `font-family-row.client.spec.tsx`, and `settings-store.client.spec.ts`. The `settings-chrome` web e2e specs apply a family, assert both body variables and the profile patch, reload, and clear back to the shipped stacks. The pack's `apply.client.spec.ts` asserts language and dictionary registration through a real `LocaleRuntime`, plus teardown.
