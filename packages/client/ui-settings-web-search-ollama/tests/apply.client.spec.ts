/** What the browser half registers, when, which credential it watches, and that it all leaves with the fiber. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { RemoteError, TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject, NS } from '../src/client/index.ts'
import type { OllamaSearchCardFace } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

// These specs assert the shipped Chinese copy. The lane has no jsdom `window`,
// so browser-language detection never runs and a fresh LocaleRuntime opens on
// FALLBACK_LOCALE (en); bench stages zh explicitly on the locale instead.

/** One Host view of a served namespace. */
function view(ns: string, revision = 0) {
  return { ns, schema: {}, value: {}, applies: 'live', secrets: [], revision }
}

/** @param served - namespaces the Host describes; omitted answers a failed read. */
async function bench(served?: string[]) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const describeCredentials = vi.fn(() => Promise.resolve({
    ok: false, error: new RemoteError('gateway/internal', 'no provider', {}),
  }))
  const describeSettings = vi.fn(() => Promise.resolve(served === undefined
    ? { ok: false, error: new RemoteError('gateway/internal', 'no provider', {}) }
    : { ok: true, value: { writable: true, hasDocument: true, namespaces: served.map(ns => view(ns)) } }))
  const remote = new TestRemote(ctx, {
    credentials: { describe: describeCredentials, set: vi.fn() },
    settings: { describe: describeSettings },
  })
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return { ctx, slots: ctx.get('slots') as SlotRegistry, describeCredentials, describeSettings, remote }
}

/** The Plugins page's Shiguredo group slot, as its owner declares it. */
function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'plugins.shiguredo': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-web-search-ollama apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.credentials', 'configForms'])
  })

  it('registers the page while the Host serves the namespace, titled in the active locale', async () => {
    const { ctx, slots } = await bench(['web-ollama-api'])
    declareRoot(slots)

    await ctx.plugin({ inject: [...inject], apply }).await()

    await vi.waitFor(() => { expect(slots.entries('plugins.shiguredo')).toHaveLength(1) })
    const entry = slots.entries('plugins.shiguredo')[0]!
    expect(entry.options).toMatchObject({ id: 'web-ollama-api', order: 21 })
    expect(resolveSlotLabel(entry.options.label)).toBe('Ollama Cloud 搜索')
    expect(entry.locale).toBe(NS)
    const face = (entry.inject as () => Pick<OllamaSearchCardFace, 'hooks'>)()
    expect(Object.keys(face.hooks)).toEqual(['ollamaSearchCard'])
  })

  it('registers nothing while the namespace is not served', async () => {
    // A deployment composing no Ollama Cloud search provider serves no such entry.
    const { ctx, slots, describeSettings } = await bench(['web-search-deepseek'])
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(describeSettings).toHaveBeenCalled() })

    expect(slots.entries('plugins.shiguredo')).toHaveLength(0)
  })

  it('re-reads the credential when the Host reports the watched reference changed, and ignores another', async () => {
    const { ctx, slots, describeCredentials, remote } = await bench()
    declareRoot(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(describeCredentials).toHaveBeenCalled() })
    describeCredentials.mockClear()

    remote.emit('credentials/reference-updated', ['SOME_OTHER_KEY'])
    await Promise.resolve()
    expect(describeCredentials).not.toHaveBeenCalled()

    // A key written on another surface changes no settings section, so this
    // event is the only thing that reaches the page.
    remote.emit('credentials/reference-updated', ['OLLAMA_CLOUD_API_KEY'])
    await vi.waitFor(() => { expect(describeCredentials).toHaveBeenCalledTimes(1) })
  })

  it('collapses the page on teardown', async () => {
    const { ctx, slots } = await bench(['web-ollama-api'])
    declareRoot(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(slots.entries('plugins.shiguredo')).toHaveLength(1) })

    await fiber.dispose()

    expect(slots.entries('plugins.shiguredo')).toHaveLength(0)
  })
})
