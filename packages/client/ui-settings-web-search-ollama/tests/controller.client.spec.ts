import { describe, expect, it, vi } from 'vitest'
import type { SettingsPathOpView } from '@deepseek-ai/dsh-api-remotes/client'
import { RemoteError, stubConfigForm, type StubConfigForm } from '@deepseek-ai/dsh-client-test-runtime'
import {
  OllamaSearchCardController,
  type OllamaSearchSettings, type WebProviderSelection,
} from '../src/client/ollama-search-card-controller.ts'

/** Make the stub behave like a Host that accepts every write. */
function acceptWrites<T>(host: StubConfigForm<T>): void {
  const section = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().value as object })
  const layer = (): Record<string, unknown> => ({ ...host.scope.getSnapshot().user as object })
  host.mutate.mockImplementation((ops: readonly SettingsPathOpView[]) => {
    const value = { ...section() }
    const user = { ...layer() }
    for (const op of ops) {
      const field = op.path[0]!
      if (op.op === 'set') {
        value[field] = op.value
        user[field] = op.value
      } else {
        Reflect.deleteProperty(user, field)
        value[field] = (host.scope.getSnapshot().base as Record<string, unknown> | undefined)?.[field]
      }
    }
    host.publish({ value: value as T, user })
    return Promise.resolve(true)
  })
}

/** The card plugin's context, scripted down to the credential namespace a card reaches. */
function ctxWith(namespaces: object) {
  return { remote: namespaces } as never
}

function credentialsApi(configured: boolean) {
  const describe = vi.fn((refs: readonly string[]) => Promise.resolve({
    ok: true as const,
    value: Object.fromEntries(refs.map(ref => [ref, { configured, writable: true }])),
  }))
  return { ctx: ctxWith({ credentials: { describe } }), describe }
}

/** The shipped selection the switch falls back to when it is turned off. */
const SHIPPED_SELECTION = { searchProvider: 'deepseek-official', fetchProvider: 'http' }

/**
 * Mount the controller over a stub provider section and a stub selection.
 * @param options - whether each Host accepts writes, the credential answer, and a scripted context.
 * @returns the scopes, the controller, its face, and a state reader.
 */
function bench(options: { accept?: boolean; configured?: boolean; ctx?: never } = {}) {
  const provider = stubConfigForm<OllamaSearchSettings>()
  const web = stubConfigForm<WebProviderSelection>()
  if (options.accept === true) {
    acceptWrites(provider)
    acceptWrites(web)
  }
  const credentials = credentialsApi(options.configured ?? true)
  const controller = new OllamaSearchCardController(
    { web: web.scope, provider: provider.scope }, options.ctx ?? credentials.ctx,
  )
  const face = controller.inject()
  return { provider, web, credentials, controller, face, state: () => face.hooks.ollamaSearchCard.getSnapshot() }
}

/** Serve both sections, with the shipped selection unless one is given. */
function serve(b: ReturnType<typeof bench>, selection: WebProviderSelection = SHIPPED_SELECTION): void {
  b.web.publish({ status: 'ready', writable: true, value: selection, base: SHIPPED_SELECTION, user: {} })
  b.provider.publish({ status: 'ready', writable: true, value: { maxResults: 5 }, base: {}, user: {} })
}

describe('OllamaSearchCardController credential', () => {
  it('reports whether the shared Ollama Cloud key is configured', async () => {
    const b = bench({ configured: false })
    await vi.waitFor(() => { expect(b.credentials.describe).toHaveBeenCalledWith(['OLLAMA_CLOUD_API_KEY']) })
    serve(b)
    await vi.waitFor(() => { expect(b.state().apiKeyConfigured).toBe(false) })
    expect(b.state()).toMatchObject({ maxResults: { text: '5', overridden: false } })
    b.controller.dispose()
  })

  it('re-reads only when the Host reports the shared reference changed', async () => {
    const b = bench({ configured: false })
    serve(b)
    await vi.waitFor(() => { expect(b.credentials.describe).toHaveBeenCalled() })
    b.credentials.describe.mockClear()
    b.controller.refreshCredential('OTHER_KEY')
    expect(b.credentials.describe).not.toHaveBeenCalled()
    b.credentials.describe.mockImplementation((refs: readonly string[]) => Promise.resolve({
      ok: true as const, value: Object.fromEntries(refs.map(ref => [ref, { configured: true, writable: true }])),
    }))
    b.controller.refreshCredential('OLLAMA_CLOUD_API_KEY')
    await vi.waitFor(() => { expect(b.state().apiKeyConfigured).toBe(true) })
    b.controller.dispose()
  })

  it('keeps the card usable when the credential read is refused', async () => {
    const describe = vi.fn(() => Promise.resolve({
      ok: false as const,
      error: new RemoteError('credential/rejected', 'offline', { ref: 'OLLAMA_CLOUD_API_KEY' }),
    }))
    const b = bench({ ctx: ctxWith({ credentials: { describe } }) })
    await vi.waitFor(() => { expect(describe).toHaveBeenCalled() })
    serve(b)
    expect(b.state()).toMatchObject({ available: true, apiKeyConfigured: false, maxResults: { text: '5' } })
    b.controller.dispose()
  })
})

describe('OllamaSearchCardController sections', () => {
  it('saves the default result count', async () => {
    const b = bench({ accept: true })
    serve(b)
    b.face.edit('maxResults', '20')
    b.face.save()
    await vi.waitFor(() => { expect(b.provider.mutate).toHaveBeenCalledTimes(1) })
    expect(b.provider.mutate).toHaveBeenCalledWith([{ op: 'set', path: ['maxResults'], value: 20 }], undefined)
    expect(b.web.mutate).not.toHaveBeenCalled()
    b.controller.dispose()
  })

  it('resets an overridden result count back to the composed default', async () => {
    const b = bench({ accept: true })
    const composed = { maxResults: 5 }
    b.provider.publish({ status: 'ready', writable: true, value: { maxResults: 9 }, base: composed, user: { maxResults: 9 } })
    expect(b.state().maxResults).toMatchObject({ text: '9', overridden: true })
    b.face.resetField('maxResults')
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(b.provider.mutate).toHaveBeenLastCalledWith([{ op: 'unset', path: ['maxResults'] }], undefined)
    b.controller.dispose()
  })

  it('rejects a non-numeric result count and saves none of the draft', () => {
    const b = bench()
    serve(b)
    b.face.edit('maxResults', 'many')
    expect(b.state()).toMatchObject({ invalid: true, maxResults: { text: 'many', invalid: true } })
    b.face.save()
    expect(b.provider.mutate).not.toHaveBeenCalled()
    b.controller.dispose()
  })

  it('saves nothing before the section is served or while a save runs', async () => {
    const b = bench({ accept: true })
    b.face.save()
    expect(b.state().available).toBe(false)
    serve(b)
    let release: (accepted: boolean) => void = () => {}
    b.provider.mutate.mockImplementation(() => new Promise<boolean>((resolve) => { release = resolve }))
    b.face.edit('maxResults', '3')
    b.face.save()
    await vi.waitFor(() => { expect(b.state().saving).toBe(true) })
    b.face.save()
    release(true)
    await vi.waitFor(() => { expect(b.state().saving).toBe(false) })
    expect(b.provider.mutate).toHaveBeenCalledTimes(1)
    b.controller.dispose()
  })

  it('releases every subscription on dispose', () => {
    const b = bench()
    serve(b)
    b.controller.dispose()
    expect(b.provider.listenerCount()).toBe(0)
    expect(b.web.listenerCount()).toBe(0)
  })
})

describe('OllamaSearchCardController switch', () => {
  it('stages both provider selections, discards them, and clears them back to the shipped defaults', async () => {
    const b = bench({ accept: true })
    serve(b)
    expect(b.state()).toMatchObject({ switchAvailable: true, useOllama: false })
    b.face.setOllama(true)
    expect(b.state()).toMatchObject({ useOllama: true, dirty: true })
    expect(b.web.mutate).not.toHaveBeenCalled()
    b.face.discard()
    expect(b.state().useOllama).toBe(false)
    b.face.setOllama(true)
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(b.web.mutate).toHaveBeenLastCalledWith([
      { op: 'set', path: ['searchProvider'], value: 'ollama-cloud-search' },
      { op: 'set', path: ['fetchProvider'], value: 'ollama-cloud-fetch' },
    ], undefined)
    expect(b.state().useOllama).toBe(true)
    b.face.setOllama(false)
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(b.web.mutate).toHaveBeenLastCalledWith([
      { op: 'unset', path: ['searchProvider'] },
      { op: 'unset', path: ['fetchProvider'] },
    ], undefined)
    expect(b.state().useOllama).toBe(false)
    expect(b.provider.mutate).not.toHaveBeenCalled()
    b.controller.dispose()
  })

  it('restores the deployment\'s own selection when it composes something else', async () => {
    const exa = { searchProvider: 'exa', fetchProvider: 'http' }
    const b = bench({ accept: true })
    b.web.publish({ status: 'ready', writable: true, value: { searchProvider: 'ollama-cloud-search' }, base: exa, user: { searchProvider: 'ollama-cloud-search' } })
    b.provider.publish({ status: 'ready', writable: true, value: { maxResults: 5 }, base: {}, user: {} })
    expect(b.state().useOllama).toBe(true)
    b.face.setOllama(false)
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    // Clearing the override is what restores Exa: writing the shipped DeepSeek
    // id here would silently replace the deployment's own search provider.
    // Only the overridden field carries a write: the fetch selection already
    // resolves to the deployment's own value, so clearing it changes nothing.
    expect(b.web.mutate).toHaveBeenLastCalledWith([
      { op: 'unset', path: ['searchProvider'] },
    ], undefined)
    b.controller.dispose()
  })

  it('writes the shipped selection explicitly when the deployment composes the Ollama providers', async () => {
    const ollama = { searchProvider: 'ollama-cloud-search', fetchProvider: 'ollama-cloud-fetch' }
    const b = bench({ accept: true })
    b.web.publish({ status: 'ready', writable: true, value: ollama, base: ollama, user: {} })
    b.provider.publish({ status: 'ready', writable: true, value: { maxResults: 5 }, base: {}, user: {} })
    expect(b.state().useOllama).toBe(true)
    b.face.setOllama(false)
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(b.web.mutate).toHaveBeenLastCalledWith([
      { op: 'set', path: ['searchProvider'], value: 'deepseek-official' },
      { op: 'set', path: ['fetchProvider'], value: 'http' },
    ], undefined)
    b.face.setOllama(true)
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(b.web.mutate).toHaveBeenLastCalledWith([
      { op: 'unset', path: ['searchProvider'] },
      { op: 'unset', path: ['fetchProvider'] },
    ], undefined)
    b.controller.dispose()
  })

  it('saves the provider section before the selection that starts using it', async () => {
    const b = bench({ accept: true })
    serve(b)
    const order: string[] = []
    for (const [name, host] of [['provider', b.provider], ['web', b.web]] as const) {
      const accept = host.mutate.getMockImplementation()!
      host.mutate.mockImplementation((ops, revision) => { order.push(name); return accept(ops, revision) })
    }
    b.face.setOllama(true)
    b.face.edit('maxResults', '7')
    b.face.save()
    await vi.waitFor(() => { expect(b.state().dirty).toBe(false) })
    expect(order).toEqual(['provider', 'web'])
    b.controller.dispose()
  })

  it('keeps the selection staged when the provider section refuses its save', async () => {
    const b = bench({ accept: true })
    serve(b)
    b.provider.mutate.mockImplementation(() => Promise.resolve(false))
    b.face.setOllama(true)
    b.face.edit('maxResults', '20')
    b.face.save()
    await vi.waitFor(() => { expect(b.state().failed).toBe(true) })
    expect(b.web.mutate).not.toHaveBeenCalled()
    expect(b.state()).toMatchObject({ useOllama: true, dirty: true })
    b.controller.dispose()
  })

  it('hides the switch and keeps the fields usable while the Host serves no selection', () => {
    const b = bench()
    serve(b)
    b.web.publish({ status: 'unavailable' })
    expect(b.state()).toMatchObject({ available: true, switchAvailable: false, useOllama: false })
    expect(b.state().maxResults.text).toBe('5')
    b.controller.dispose()
  })
})
