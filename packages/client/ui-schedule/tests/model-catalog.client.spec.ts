import { describe, expect, it, vi } from 'vitest'
import type { ModelCatalog, RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import { RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import { createModelCatalogSource } from '../src/client/model-catalog.ts'

const catalog: ModelCatalog = {
  default: { provider: 'deepseek', model: 'deepseek-chat' },
  routableProviders: ['deepseek'],
  groups: [{ id: 'deepseek', name: 'DeepSeek', models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] }],
  failures: [],
}
const ready: RemoteResult<ModelCatalog> = { ok: true, value: catalog }
const failure: RemoteResult<ModelCatalog> = { ok: false, error: new RemoteError('gateway/internal', 'Unavailable', {}) }

function harness() {
  const load = vi.fn<() => Promise<RemoteResult<ModelCatalog>>>().mockResolvedValue(ready)
  const source = createModelCatalogSource(load)
  const hook = source.hooks.modelCatalog
  return { source, hook, load }
}

describe('Schedule model catalog source', () => {
  it('reads once for every subscriber and republishes only when the read settles', async () => {
    const h = harness()
    const listener = vi.fn()
    const dispose = h.hook.subscribe(listener)
    expect(h.load).toHaveBeenCalledOnce()
    expect(h.hook.getSnapshot()).toEqual({ status: 'loading', catalog: undefined })
    // A second editor mounting joins the read already in flight.
    const join = h.hook.subscribe(vi.fn())
    expect(h.load).toHaveBeenCalledOnce()
    await vi.waitFor(() => { expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog }) })
    // The loading republish and the settled read both reached the mounted editor.
    expect(listener).toHaveBeenCalledTimes(2)
    const settled = h.hook.getSnapshot()
    expect(h.hook.getSnapshot()).toBe(settled)
    join()
    dispose()
  })

  it('keeps the last successful catalog and reports the failure when a retry fails', async () => {
    const h = harness()
    const dispose = h.hook.subscribe(vi.fn())
    await vi.waitFor(() => { expect(h.hook.getSnapshot().status).toBe('ready') })
    h.load.mockResolvedValueOnce(failure)
    await h.source.onRetry()
    expect(h.hook.getSnapshot()).toEqual({ status: 'error', catalog })
    // The retry row sits on the destination rows, which stay usable from the retained catalog.
    h.load.mockResolvedValueOnce({ ok: true, value: { ...catalog, failures: [{ id: 'openrouter', name: 'OpenRouter', message: 'Offline' }] } })
    await h.source.onRetry()
    expect(h.hook.getSnapshot().status).toBe('ready')
    expect(h.hook.getSnapshot().catalog?.failures).toEqual([{ id: 'openrouter', name: 'OpenRouter', message: 'Offline' }])
    dispose()
  })

  it('contains a rejected request and rereads from the failed state', async () => {
    const h = harness()
    h.load.mockRejectedValueOnce(new Error('Disconnected'))
    const dispose = h.hook.subscribe(vi.fn())
    await vi.waitFor(() => { expect(h.hook.getSnapshot()).toEqual({ status: 'error', catalog: undefined }) })
    dispose()
    // A retry issued before any editor subscribes still reads for the next mount.
    await h.source.onRetry()
    expect(h.load).toHaveBeenCalledTimes(2)
    expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog })
  })

  it('rereads after a Host model input change and keeps the previous catalog visible while loading', async () => {
    const h = harness()
    const dispose = h.hook.subscribe(vi.fn())
    await vi.waitFor(() => { expect(h.hook.getSnapshot().status).toBe('ready') })
    const next = Promise.withResolvers<RemoteResult<ModelCatalog>>()
    h.load.mockReturnValueOnce(next.promise)
    h.source.refresh()
    expect(h.load).toHaveBeenCalledTimes(2)
    expect(h.hook.getSnapshot()).toEqual({ status: 'loading', catalog })
    next.resolve(ready)
    await vi.waitFor(() => { expect(h.hook.getSnapshot().status).toBe('ready') })
    dispose()
  })

  it('defers a refresh requested before any editor subscribes to the next mount', () => {
    const h = harness()
    h.source.refresh()
    expect(h.load).not.toHaveBeenCalled()
    const dispose = h.hook.subscribe(vi.fn())
    expect(h.load).toHaveBeenCalledOnce()
    dispose()
  })

  it('drops the previous Host generation and ignores its in-flight answer', async () => {
    const h = harness()
    const previous = Promise.withResolvers<RemoteResult<ModelCatalog>>()
    h.load.mockReturnValueOnce(previous.promise)
    const dispose = h.hook.subscribe(vi.fn())
    h.source.reset()
    expect(h.hook.getSnapshot()).toEqual({ status: 'loading', catalog: undefined })
    await vi.waitFor(() => { expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog }) })
    // The generation this reset replaced settles afterwards and must not publish.
    previous.resolve(failure)
    await Promise.resolve()
    expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog })
    dispose()
  })

  it('drops the stale catalog when a reset arrives before any editor mounts', async () => {
    const h = harness()
    h.source.reset()
    expect(h.hook.getSnapshot()).toEqual({ status: 'loading', catalog: undefined })
    const dispose = h.hook.subscribe(vi.fn())
    await vi.waitFor(() => { expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog }) })
    expect(h.load).toHaveBeenCalledOnce()
    dispose()
  })

  it('ignores the previous generation rejection after a reset', async () => {
    const h = harness()
    const previous = Promise.withResolvers<RemoteResult<ModelCatalog>>()
    h.load.mockReturnValueOnce(previous.promise)
    const dispose = h.hook.subscribe(vi.fn())
    h.source.reset()
    await vi.waitFor(() => { expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog }) })
    // The generation this reset replaced fails afterwards and must not publish.
    previous.reject(new Error('Disconnected'))
    await Promise.resolve()
    expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog })
    dispose()
  })

  it('reuses a ready catalog when an editor mounts after an earlier one left', async () => {
    const h = harness()
    const first = h.hook.subscribe(vi.fn())
    await vi.waitFor(() => { expect(h.hook.getSnapshot().status).toBe('ready') })
    first()
    const second = h.hook.subscribe(vi.fn())
    expect(h.load).toHaveBeenCalledOnce()
    second()
  })

  it('shares one read between a mounted editor and a retry it asks for', async () => {
    const h = harness()
    const read = Promise.withResolvers<RemoteResult<ModelCatalog>>()
    h.load.mockReturnValueOnce(read.promise)
    const dispose = h.hook.subscribe(vi.fn())
    const retry = h.source.onRetry()
    expect(h.load).toHaveBeenCalledOnce()
    expect(h.hook.getSnapshot().status).toBe('loading')
    read.resolve(ready)
    await retry
    expect(h.hook.getSnapshot()).toEqual({ status: 'ready', catalog })
    dispose()
  })
})
