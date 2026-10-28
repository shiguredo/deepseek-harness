# Agent Note: Locale-neutral font stacks for CJK text

Status: implemented

English | [中文](2026-09-15-locale-neutral-font-stacks.zh.md)

## Problem

The shipped font stacks name Chinese CJK families (`'PingFang SC'`, `'Hiragino Sans GB'`, `'Microsoft YaHei'`) ahead of any other CJK family, and the code stack ends in those same families. A page whose language is Japanese therefore renders Han characters with Chinese glyph variants on every platform, and its monospaced text cannot fall through to a generic family: the stack terminates in a CJK family rather than in the generic the browser would resolve per language.

## Decision

The fork keeps the built-in stacks in `packages/client/ui-theme/src/styles/base.css` locale-neutral. The text stack names no CJK family, so the browser resolves CJK glyph selection from the page language; the code stack also ends in the generic sans instead of a CJK family, so Windows CJK does not fall back to SimSun. Per-role family and size choices remain ui-theme's font settings, which place the user's lists (`--dsh-font-family-text`, `--dsh-font-family-code`) ahead of these stacks on `body`.

Japanese UI text itself is no longer a fork concern: the client registers `ja` and every shipped package carries a complete Japanese dictionary, so this fork keeps no language pack of its own.

## Alternatives considered

- **Pin Japanese families in the default stack.** Putting `'Hiragino Sans'` ahead of the Chinese families fixes Japanese at the cost of Chinese glyph selection on a Chinese page, and the browser already follows the page language for both. Rejected in favor of removing the CJK pins.
- **A feature plugin storing the chosen family.** Font customization ships in ui-theme (text, code, and terminal families and sizes), so the fork keeps no font plugin of its own and only adjusts the built-in stacks. Rejected as duplicated behavior.
- **Keep the stack as shipped and rely on per-user font settings.** A deployment that has not configured families would still show Chinese glyph forms for Japanese text, which is the case the default has to serve. Rejected.

## Consequences

- Glyph selection follows the page language out of the box, and a user who wants a specific family names it through ui-theme's font settings.
- The default stacks are the only fork-owned divergence here; an upstream change to `base.css` conflicts in that one file.

## Testing

The `settings-chrome` web e2e specs cover ui-theme's font settings rows over these stacks.
