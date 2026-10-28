// @vitest-environment jsdom

/**
 * Browser-half lifecycle over the real SlotRegistry: the single composer-chip
 * contribution, the injected route face, all eight dictionaries, and fiber
 * teardown proving removal (HMR safety). The built-in package ships no sidebar
 * entry and no main page.
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { apply, inject } from '../src/client/index.ts'
import { GuardChip } from '../src/client/Chip.tsx'
import { GuardSettingsCard } from '../src/client/SettingsCard.tsx'
import { de, en, es, fr, ja, NS, pt, ru, zh } from '../src/client/locales.ts'
import type { GuardApi } from '../src/client/state.ts'
import { apply as nodeApply } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Boot the browser half over a real slot tree declaring the composer-left seat. */
async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']>; locale: LocaleRuntime }> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.input.left': { kind: 'list', scope: 'session' },
      'plugins.shiguredo': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  onTestFinished(async () => { await fiber.dispose() })
  return { ctx, fiber, locale }
}

/** Register the selectable languages the shipped language packs add. */
function addLanguages(locale: LocaleRuntime): void {
  for (const [id, label] of [
    ['ja', '日本語'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['ru', 'Русский'], ['pt', 'Português'],
  ] as const) {
    locale.addLanguage({ id, label, fallback: 'en' })
  }
}

describe('ui-git-push-guard browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers the composer chip and the built-in settings card, and removes both on disposal', async () => {
    const { ctx, fiber } = await bench()
    const chip = ctx.slots.entries('conversation.input.left')[0]
    expect(chip?.component).toBe(GuardChip)
    expect(chip?.options).toMatchObject({ id: 'git-push-guard', order: 40 })
    const settings = ctx.slots.entries('plugins.shiguredo')[0]
    expect(settings?.component).toBe(GuardSettingsCard)
    expect(settings?.options).toMatchObject({ id: 'git-push-guard', order: 60 })
    expect(ctx.slots.entries('sidebar.panellist')).toHaveLength(0)
    expect(ctx.slots.entries('main')).toHaveLength(0)
    await fiber.dispose()
    expect(ctx.slots.entries('conversation.input.left')).toHaveLength(0)
    expect(ctx.slots.entries('plugins.shiguredo')).toHaveLength(0)
  })

  it('injects one route face into the chip', async () => {
    const { ctx } = await bench()
    const chipApi = ctx.slots.entries('conversation.input.left')[0]?.inject?.() as GuardApi | undefined
    expect(typeof chipApi?.loadState).toBe('function')
    expect(typeof chipApi?.saveState).toBe('function')
  })

  it('registers every shipped dictionary under its own namespace', async () => {
    const { locale } = await bench()
    addLanguages(locale)
    const dictionaries = [['en', en], ['ja', ja], ['es', es], ['fr', fr], ['de', de], ['ru', ru], ['pt', pt], ['zh', zh]] as const
    for (const [id, dictionary] of dictionaries) {
      locale.setLocale(id)
      expect(locale.bind(NS)('chipOn')).toBe(dictionary['chipOn'])
      expect(locale.bind(NS)('statusLoading')).toBe(dictionary['statusLoading'])
      expect(locale.bind(NS)('chipFailed')).toBe(dictionary['chipFailed'])
    }
  })

  it('keeps every dictionary key-identical to the Chinese source of truth', () => {
    const keys = Object.keys(zh).sort()
    for (const dictionary of [en, ja, es, fr, de, ru, pt]) {
      expect(Object.keys(dictionary).sort()).toEqual(keys)
    }
  })
})

describe('ui-git-push-guard node half', () => {
  it('the node apply is an inert loader seat', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
