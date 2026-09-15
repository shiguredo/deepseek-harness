// @vitest-environment jsdom
/** ui-font-family apply wiring: settings scope binding, body-variable
 * application, declaration-aware Font row registration, face writes, and HMR
 * teardown. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject, type FontFamilyRowInjected } from '@deepseek-ai/dsh-client-ui-font-family/client'
import { FONT_SETTINGS_NAMESPACE, FontSettingsSchema } from '../src/font-settings.ts'
import { NS } from '../src/client/locales.ts'
import { FontFamilyRow } from '../src/client/FontFamilyRow.tsx'
import type { createFontFamilyRowStore } from '../src/client/settings-store.ts'

const SLOT = 'settings.general.item'
const UI_FONT_VARIABLE = '--dsw-font-family'
const CODE_FONT_VARIABLE = '--ds-font-family-code'

/** One describe answer as the settings mirror consumes it. */
type DescribeResult = {
  ok: true
  value: { writable: boolean; hasDocument: boolean; namespaces: readonly unknown[] }
}

afterEach(() => {
  document.body.style.removeProperty(UI_FONT_VARIABLE)
  document.body.style.removeProperty(CODE_FONT_VARIABLE)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function bench(options: { isLoopback?: boolean; firstDescribe?: Promise<DescribeResult> } = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const section = new Map<string, unknown>()
  let revision = 0
  const namespace = () => ({
    ns: FONT_SETTINGS_NAMESPACE,
    schema: FontSettingsSchema.toJSON(),
    value: Object.fromEntries(section),
    applies: 'live' as const,
    secrets: [],
    revision,
  })
  const describe = vi.fn(() => Promise.resolve({
    ok: true as const,
    value: { writable: true, hasDocument: true, namespaces: [namespace()] },
  }))
  const mutate = vi.fn((_ns: string, ops: readonly { op: string; path: string[]; value?: unknown }[]) => {
    for (const op of ops) {
      const field = op.path[0] ?? ''
      if (op.op === 'unset') section.delete(field)
      else section.set(field, op.value)
    }
    revision += 1
    return Promise.resolve({ ok: true as const, value: namespace() })
  })
  const events = new TestRemote(ctx, { settings: { describe, mutate } })
  events.$host = { home: undefined, isLoopback: options.isLoopback ?? true }
  const firstDescribe = options.firstDescribe
  // The fixture names the wire shape itself; the mock's inferred return type
  // spells the same fields out, so the pending answer crosses with one cast.
  if (firstDescribe !== undefined) describe.mockImplementationOnce(() => firstDescribe as never)
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale, describe, mutate, events,
    setHostSection: (next: Record<string, unknown>) => {
      for (const [field, value] of Object.entries(next)) section.set(field, value)
      revision += 1
    },
  }
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
  const face = (entry.inject as unknown as (a: typeof instance.actions) => FontFamilyRowInjected)(instance.actions)
  return { entry, instance, face }
}

describe('ui-font-family apply', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'settingsScope'])
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

  it('leaves the shipped stacks alone, applies a written family, and retracts on teardown', async () => {
    const b = await bench()
    declareItems(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(b.describe).toHaveBeenCalled() })
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('')
    expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('')

    const { instance, face } = fontRowFace(b.slots)
    face.setFontFamily('  "Hiragino Sans", "Noto Sans JP"  ')
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('"Hiragino Sans", "Noto Sans JP"')
    })
    expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('"Hiragino Sans", "Noto Sans JP"')
    expect(b.mutate).toHaveBeenCalledWith(FONT_SETTINGS_NAMESPACE, [
      { op: 'set', path: ['fontFamily'], value: '"Hiragino Sans", "Noto Sans JP"' },
    ], 0)
    await vi.waitFor(() => {
      expect(instance.getSnapshot().fontFamily).toBe('"Hiragino Sans", "Noto Sans JP"')
    })

    face.setFontFamily('   ')
    await vi.waitFor(() => { expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('') })
    expect(b.mutate).toHaveBeenLastCalledWith(FONT_SETTINGS_NAMESPACE, [
      { op: 'unset', path: ['fontFamily'] },
    ], 1)
    await vi.waitFor(() => { expect(instance.getSnapshot().fontFamily).toBe('') })

    await fiber.dispose()
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('')
    expect(document.body.style.getPropertyValue(CODE_FONT_VARIABLE)).toBe('')
    expect(b.slots.entries(SLOT).some(e => e.component === FontFamilyRow)).toBe(false)
  })

  it('leaves the bootstrap value standing until the first accepted section', async () => {
    const pending = deferred<DescribeResult>()
    const b = await bench({ firstDescribe: pending.promise })
    declareItems(b.slots)
    document.body.style.setProperty(UI_FONT_VARIABLE, '"Boot Font"')
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('"Boot Font"')
    pending.resolve({
      ok: true,
      value: {
        writable: true,
        hasDocument: true,
        namespaces: [{
          ns: FONT_SETTINGS_NAMESPACE,
          schema: FontSettingsSchema.toJSON(),
          value: { fontFamily: '"Kept Font"' },
          applies: 'live',
          secrets: [],
          revision: 1,
        }],
      },
    })
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
    expect(b.mutate).not.toHaveBeenCalled()
  })

  it('adopts a document change published for its namespace', async () => {
    const b = await bench()
    declareItems(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const { instance } = fontRowFace(b.slots)
    b.setHostSection({ fontFamily: 'Custom Font' })
    b.events.emit('settings/document-updated', [FONT_SETTINGS_NAMESPACE, 0])
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('Custom Font')
    })
    await vi.waitFor(() => { expect(instance.getSnapshot().fontFamily).toBe('Custom Font') })
  })

  it('leaves the shipped stacks and skips writes when settings stay process-local', async () => {
    const remote = await bench({ isLoopback: false })
    declareItems(remote.slots)
    await remote.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(remote.describe).not.toHaveBeenCalled() })
    expect(document.body.style.getPropertyValue(UI_FONT_VARIABLE)).toBe('')
    const { face } = fontRowFace(remote.slots)
    face.setFontFamily('"Hiragino Sans"')
    await Promise.resolve()
    expect(remote.mutate).not.toHaveBeenCalled()
  })
})
