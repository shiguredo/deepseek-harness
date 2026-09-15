/**
 * The font-family preference this plugin owns end to end: the durable settings
 * namespace, the schema the Host validates writes against, and the one
 * normalization both halves share. With no stored family the shipped theme
 * stacks stay untouched; the plugin only ever writes a family the user chose.
 */

import z from '@deepseek-ai/schemastery'

/** Settings namespace this plugin registers on the Host and binds in the browser. */
export const FONT_SETTINGS_NAMESPACE = 'ui-font-family'

/** Field carrying the user-specified CSS font-family override. */
export const FONT_FAMILY_FIELD = 'fontFamily'

/** Longest accepted font-family override (characters). */
export const FONT_FAMILY_MAX_LENGTH = 256

/**
 * Accepted font-family override: non-empty text without the declaration
 * delimiters and control characters that would end or corrupt the CSS
 * declaration the override is written into.
 */
export const FONT_FAMILY_PATTERN = /^[^;{}\u0000-\u001F\u007F]+$/u

/** Durable font section. */
export interface FontSettings {
  /** CSS font-family list applied to UI text and code; absent keeps the shipped stacks. */
  fontFamily?: string
}

/** Body variables carrying the chosen family: UI text first, code second. */
export const FONT_FAMILY_VARIABLES = ['--dsw-font-family', '--ds-font-family-code'] as const

/** Durable font schema fields; also the wire envelope the browser scope validates against. */
export const FontSettingsFields = {
  [FONT_FAMILY_FIELD]: z.string().max(FONT_FAMILY_MAX_LENGTH).pattern(FONT_FAMILY_PATTERN).required(false),
}

/** Durable font schema. */
export const FontSettingsSchema: z<FontSettings> = z.object(FontSettingsFields)

/**
 * Normalize one font-family override from the settings row: surrounding
 * whitespace is insignificant, and an empty value means the default stacks.
 * @param value - raw CSS font-family list, or an empty value.
 * @returns the trimmed list, or undefined when the default stacks stay active.
 * @throws when the value cannot appear in one CSS declaration value.
 */
export function normalizeFontFamily(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  if (!FONT_FAMILY_PATTERN.test(trimmed)) {
    throw new Error(`font family ${JSON.stringify(value)} contains characters that cannot appear in a CSS font-family list`)
  }
  if (trimmed.length > FONT_FAMILY_MAX_LENGTH) {
    throw new Error(`font family is longer than ${FONT_FAMILY_MAX_LENGTH} characters`)
  }
  return trimmed
}
