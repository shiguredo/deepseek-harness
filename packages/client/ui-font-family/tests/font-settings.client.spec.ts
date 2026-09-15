/** Font settings vocabulary: normalization and limits. */
import { describe, expect, it } from 'vitest'
import { FONT_FAMILY_MAX_LENGTH, normalizeFontFamily } from '../src/font-settings.ts'

describe('normalizeFontFamily', () => {
  it('trims one CSS font-family list and treats empty input as no override', () => {
    expect(normalizeFontFamily('  "Hiragino Sans", sans-serif  ')).toBe('"Hiragino Sans", sans-serif')
    expect(normalizeFontFamily('   ')).toBeUndefined()
    expect(normalizeFontFamily('')).toBeUndefined()
  })

  it('rejects declaration delimiters, control characters, and over-long values', () => {
    for (const value of ['broken ; value', '{oops}', 'line\nbreak', 'nul\u0000byte']) {
      expect(() => normalizeFontFamily(value)).toThrow(/cannot appear/u)
    }
    expect(() => normalizeFontFamily('x'.repeat(FONT_FAMILY_MAX_LENGTH + 1))).toThrow(/longer than/u)
    expect(normalizeFontFamily('x'.repeat(FONT_FAMILY_MAX_LENGTH))).toBe('x'.repeat(FONT_FAMILY_MAX_LENGTH))
  })
})
