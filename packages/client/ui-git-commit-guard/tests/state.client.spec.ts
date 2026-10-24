/**
 * Route helpers over a stubbed fetch: both addresses, both verbs, the
 * validated answer fields, and every failure the chip renders as its quiet
 * error state.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { loadState, saveState } from '../src/client/state.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Install one fetch stub returning a fixed response, and hand back its mock. */
function stubFetch(response: Partial<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ default: true }),
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('loadState', () => {
  it('reads the default from the bare route', async () => {
    const fetchMock = stubFetch({})
    await expect(loadState()).resolves.toEqual({ default: true })
    expect(fetchMock).toHaveBeenCalledWith('/commit-guard/state', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
  })

  it('addresses one Session with the encoded query and validates its answer', async () => {
    const fetchMock = stubFetch({ json: () => Promise.resolve({ default: true, session: false }) })
    await expect(loadState(SessionId('session a/b'))).resolves.toEqual({ default: true, session: false })
    expect(fetchMock).toHaveBeenCalledWith('/commit-guard/state?session=session%20a%2Fb', expect.anything())
  })

  it('rejects a non-object payload, a missing default, and a missing session', async () => {
    stubFetch({ json: () => Promise.resolve(null) })
    await expect(loadState()).rejects.toThrow(/not a JSON object/)
    stubFetch({ json: () => Promise.resolve({}) })
    await expect(loadState()).rejects.toThrow(/no boolean "default"/)
    stubFetch({ json: () => Promise.resolve([]) })
    await expect(loadState()).rejects.toThrow(/no boolean "default"/)
    stubFetch({ json: () => Promise.resolve({ default: true }) })
    await expect(loadState(SessionId('s1'))).rejects.toThrow(/no boolean "session"/)
  })

  it('rejects a non-2xx answer and a failing JSON read', async () => {
    stubFetch({ ok: false, status: 503 })
    await expect(loadState()).rejects.toThrow(/failed: 503/)
    stubFetch({ json: () => Promise.reject(new Error('broken body')) })
    await expect(loadState()).rejects.toThrow(/broken body/)
  })
})

describe('saveState', () => {
  it('posts the default setting', async () => {
    const fetchMock = stubFetch({ json: () => Promise.resolve({ default: false }) })
    await expect(saveState(false)).resolves.toEqual({ default: false })
    expect(fetchMock).toHaveBeenCalledWith('/commit-guard/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })
  })

  it('posts one Session setting', async () => {
    const fetchMock = stubFetch({ json: () => Promise.resolve({ default: true, session: false }) })
    await expect(saveState(false, SessionId('s1'))).resolves.toEqual({ default: true, session: false })
    expect(fetchMock).toHaveBeenCalledWith('/commit-guard/state', expect.objectContaining({
      body: JSON.stringify({ enabled: false, sessionId: 's1' }),
    }))
  })
})
