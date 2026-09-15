/**
 * Font bootstrap row for the browser's pre-plugin interval: when the durable
 * section holds a family, each index render embeds one script that writes it,
 * so the first paint after a reload already carries the user's choice. No
 * stored family means no row and the shipped theme stacks stay untouched.
 */

import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { FONT_FAMILY_VARIABLES } from './font-settings.ts'

/**
 * The font bootstrap as an injection row: an inline script immediately after
 * the opening body tag, before the shell mount and module script.
 * @param fontFamily - Current Host-backed font-family override, when one is set.
 * @returns the body script row, or undefined when the shipped stacks stay active.
 */
export function bootFontInjection(fontFamily?: string): IndexInjection | undefined {
  if (fontFamily === undefined) return undefined
  const value = JSON.stringify(fontFamily)
  const writes = FONT_FAMILY_VARIABLES
    .map(name => `  document.body.style.setProperty('${name}', ${value})`)
    .join('\n')
  return { kind: 'script', placement: 'body', text: `(() => {\n${writes}\n})()` }
}
