# Agent Note: Japanese UI support — ja language pack and locale-neutral stacks

Status: implemented

English | [中文](2026-09-15-japanese-ui-language-pack.zh.md)

## Problem

The Web client ships Chinese and English only, and the language selector offers no third choice. The shipped font stacks pin Chinese CJK families (`'PingFang SC'`, `'Hiragino Sans GB'`, `'Microsoft YaHei'`) ahead of any other CJK family, so Japanese text renders with Chinese glyph variants on every platform. A Japanese-first deployment needs the locale and correct Japanese glyph selection.

## Decision

Japanese ships as a language pack, not as a third built-in locale. `@deepseek-ai/dsh-client-locale-ja` (`packages/client/locale-ja`) activates in the web-app bundle roster and registers `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })` plus one Japanese dictionary for each shipped namespace through the per-locale `register(ns, 'ja', dict)` form. Each dictionary is declared as `LocaleDictOf<'ns'>` with a type-only import of the owning package, so a missing, extra, or renamed key fails the build; a namespace the pack does not carry falls back to English at runtime through the declared chain.

The fork keeps the built-in font stacks in `packages/client/ui-theme/src/styles/base.css` locale-neutral: they name no CJK family, so the browser picks the glyph set the page language asks for, and a `ja` page takes Japanese glyph forms instead of the Chinese ones a pinned `PingFang SC` / `Microsoft YaHei` would give. The code stack also omits a bare `monospace` tail (Windows CJK then falls back to SimSun) and ends in the generic sans instead. Per-role family and size choices remain ui-theme's font settings, which place the user's lists ahead of these stacks.

## Alternatives considered

- **First-class `ja` in `LOCALE_IDS`.** The typed `register(ns, { zh, en, ja })` form would force a Japanese dictionary into every package's registration and make every upstream string change a conflict surface in this fork. Language packs are the documented mechanism for languages outside the shipped pair; rejected.
- **Partial pack coverage first.** A partly translated UI presents two languages at once in one screen; the pack ships complete coverage of the current namespaces, with English fallback covering later upstream additions; rejected.
- **A feature plugin storing the chosen family.** Font customization now ships upstream in `ui-theme` (text, code, and terminal families and sizes), so the fork keeps no font plugin of its own and only adjusts the built-in stacks; rejected as duplicated behavior.
- **Pinning Japanese families in the default stack.** Adding `'Hiragino Sans'` before the Chinese families would fix Japanese at the cost of Chinese glyph selection on a Japanese-first stack, and browser defaults already follow the page language for both; rejected in favor of removing the CJK pins, which leaves glyph selection to the browser for every language.

## Consequences

- The ja pack adds a language, not font control: the locale-neutral default stacks cover Japanese glyph selection out of the box, and users name specific families through ui-theme's font settings.
- Font-stack completeness is compile-time enforced for every namespace the pack covers; an upstream key rename breaks the pack build until translated, which is the intended maintenance pressure for this fork, while runtime never blanks a key because English terminates the chain.
- The pack is additive: an upstream sync conflicts in the dictionary modules only where keys changed, never in the owner packages, and in `base.css` where the default stacks changed.

## Testing

Unit coverage: the pack's `apply.client.spec.ts` asserts language and dictionary registration through a real `LocaleRuntime`, plus teardown; `node-plugin.client.spec.ts` keeps the node half callable. The `settings-chrome` web e2e specs cover the upstream font settings rows over these stacks.
