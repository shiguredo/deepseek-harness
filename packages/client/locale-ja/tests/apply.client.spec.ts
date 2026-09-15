/** locale-ja apply wiring: the language definition, every dictionary over the
 * real locale registry, English fallback for uncovered namespaces, and
 * disposal through the plugin fiber. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '@deepseek-ai/dsh-client-locale-ja/client'
import { DICTIONARIES } from '../src/client/dicts/index.ts'

async function bench() {
  const ctx = new Context()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, locale, fiber }
}

describe('locale-ja apply', () => {
  it('registers ja after the shipped pair and answers translations from its dictionaries', async () => {
    const { locale } = await bench()
    expect(locale.getSnapshot().locales.map(entry => entry.id)).toEqual(['zh', 'en', 'ja'])
    expect(locale.getSnapshot().locales.find(entry => entry.id === 'ja'))
      .toMatchObject({ label: '日本語', fallback: 'en' })
    locale.setLocale('ja')
    expect(locale.bind('common')('cancel')).toBe('キャンセル')
    expect(locale.bind('settings.locale')('language.title')).toBe('言語')
    expect(locale.bind('settings.font')('fontFamily.title')).toBe('フォント')
  })

  it('falls back to English for a namespace the pack does not carry', async () => {
    const { locale } = await bench()
    locale.register('untranslated', 'en', { key: 'English copy' })
    locale.setLocale('ja')
    expect(locale.bind('untranslated')('key')).toBe('English copy')
  })

  it('ships one non-empty dictionary per namespace with no duplicate registration', () => {
    const namespaces = DICTIONARIES.map(entry => entry.ns)
    expect(new Set(namespaces).size).toBe(namespaces.length)
    for (const { ns, dict } of DICTIONARIES) {
      expect(Object.keys(dict).length, ns).toBeGreaterThan(0)
    }
    expect(namespaces).toContain('common')
    expect(namespaces).toContain('settings.theme')
  })

  it('returns to the shipped pair and drops the dictionaries with its fiber', async () => {
    const { locale, fiber } = await bench()
    locale.setLocale('ja')
    expect(locale.bind('common')('cancel')).toBe('キャンセル')
    await fiber.dispose()
    expect(locale.getSnapshot().locales.map(entry => entry.id)).toEqual(['zh', 'en'])
    // Dictionary disposal: translation falls back to the bare key.
    expect(locale.bind('common')('cancel')).toBe('cancel')
  })
})
