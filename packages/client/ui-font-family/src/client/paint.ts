/**
 * DOM writer for the two font-family variables. This plugin is their only
 * writer: ui-layout's presenter owns the palette and typography tokens, while
 * `--dsw-font-family` and `--ds-font-family-code` carry the user's choice.
 * No choice means no inline value, so the shipped theme stacks apply.
 */

import { FONT_FAMILY_VARIABLES } from '../font-settings.ts'

/**
 * Apply the chosen family to the document body, or retract both variables so
 * the shipped stacks return.
 * @param fontFamily - normalized user list, or undefined for the shipped stacks.
 */
export function applyFontFamily(fontFamily: string | undefined): void {
  if (fontFamily === undefined) {
    clearFontFamily()
    return
  }
  document.body.style.setProperty(FONT_FAMILY_VARIABLES[0], fontFamily)
  document.body.style.setProperty(FONT_FAMILY_VARIABLES[1], fontFamily)
}

/** Retract both body variables, returning the document to the shipped theme stacks. */
export function clearFontFamily(): void {
  for (const name of FONT_FAMILY_VARIABLES) document.body.style.removeProperty(name)
}
