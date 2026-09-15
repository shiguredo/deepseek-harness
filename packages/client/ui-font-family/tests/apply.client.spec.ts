// @vitest-environment jsdom
/** ui-font-family apply wiring: configuration-form binding, body-variable
 * application, validation, Font row registration, and HMR teardown. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { stubConfigForm } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, type FontFamilyRowInjected } from '@deepseek-ai/dsh-client-ui-font-family/client'
import type { FontSettings } from '../src/font-settings.ts'
import { NS } from '../src/client/locales.ts'
import { FontFamilyRow } from '../src/client/FontFamilyRow.tsx'
import type { createFontFamilyRowStore } from '../src/client/settings-store.ts'

const SLOT = 'settings.general.item'
const UI_FONT_VARIABLE = '--dsw-font-family'
const CODE_FONT_VARIABLE = '--ds-font-family-code'

afterEach(() => {
  document.body.style.removeProperty(UI_FONT_VARIABLE)
  document.body.style.removeProperty(CODE_FONT_VARIABLE)
})

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const form = stubConfigForm<FontSettings>()
  ctx.provide('configForms', { get: () => form.scope } as never)
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, form }
}

/** Stand in for the settings shell: declare the General item slot from root. */
function declareItems(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

/** Mirror the framework's inject choreography: bake a real instance from the
 * declared handle and hand its actions to the entry's inject factory. */
function fontRowFace(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(e => e.component === FontFamilyRow)!
  const handle = entry.store as ReturnType<typeof createFontFamilyRowStore>
  const instance = handle.create()
  const face = (entry.inject as (a: typeof instance.actions) => Pick<FontFamilyRowInjected, keyof FontFamilyRowInjected>)(instance.actions)
  return { entry, instance, face }
}

describe('ui-font-family apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'configForms'])
  })

  it('registers localized copy and the Font row (declaration before or after apply)', async () => {
    const before = await bench()
    declareItems(before.slots)
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    expect(before.locale.bind(NS)('fontFamily.title')).toBe('字体')
    before.locale.setLocale('en')
    expect(before.locale.bind(NS)('fontFamily.title')).toBe('Font')
    const entry = before.slots.entries(SLOT).find(e => e.component === FontFamilyRow)!
    expect(entry.options).toMatchObject({ id: 'font-family', order: 12 })

    const after = await bench()
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    declareItems(after.slots)
    expect(after.slots.entries(SLOT).some(e => e.component === FontFamilyRow)).toBe(true)
  })

  it('leaves the shipped stacks alone, applies an accepted family, and retracts on teardown', async () => {
    const b = await bench()
    declareItems(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('')
    expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('')

    b.form.publish({ status: 'ready', value: { fontFamily: '"Kept Font"' }, revision: 1 })
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('"Kept Font"')
    })

    const { instance, face } = fontRowFace(b.slots)
    face.setFontFamily('  "Hiragino Sans", "Noto Sans JP"  ')
    expect(b.form.set).toHaveBeenCalledWith('fontFamily', '"Hiragino Sans", "Noto Sans JP"')
    b.form.publish({ value: { fontFamily: '"Hiragino Sans", "Noto Sans JP"' }, revision: 2 })
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('"Hiragino Sans", "Noto Sans JP"')
    })
    await vi.waitFor(() => {
      expect(instance.getSnapshot().fontFamily).toBe('"Hiragino Sans", "Noto Sans JP"')
    })

    face.setFontFamily('   ')
    expect(b.form.unset).toHaveBeenCalledWith('fontFamily')
    b.form.publish({ value: {}, revision: 3 })
    await vi.waitFor(() => { expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('') })
    await vi.waitFor(() => { expect(instance.getSnapshot().fontFamily).toBe('') })

    await fiber.dispose()
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('')
    expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('')
    expect(b.slots.entries(SLOT).some(e => e.component === FontFamilyRow)).toBe(false)
  })

  it('leaves the bootstrap value standing until the first accepted section', async () => {
    const b = await bench()
    declareItems(b.slots)
    document.body.style.setProperty(UI_FONT_VARIABLE, '"Boot Font"')
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('"Boot Font"')
    b.form.publish({ status: 'ready', value: { fontFamily: '"Kept Font"' }, revision: 1 })
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('"Kept Font"')
    })
    await fiber.dispose()
  })

  it('rejects text that cannot be one CSS font-family list without touching the wire', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const { face } = fontRowFace(b.slots)
    expect(() => { face.setFontFamily('broken ; value') }).toThrow(/cannot appear/u)
    expect(() => { face.setFontFamily('x'.repeat(257)) }).toThrow(/longer than/u)
    expect(b.form.set).not.toHaveBeenCalled()
    expect(b.form.unset).not.toHaveBeenCalled()
  })
})
