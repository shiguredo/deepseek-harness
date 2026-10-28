import { afterEach, describe, expect, it } from 'vitest'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiPeakDay, PiAiPeakProvider, PiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { Config, resolveProfiles } from '../src/config.ts'
import { selectPeakWindow } from '../src/peak.ts'
import { memoryAuth } from './auth-double.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'

afterEach(async () => {
  await closeMockServers()
})

/** One adapter over the real profile resolver with a fixed key and clock. */
function adapter(providers: Record<string, PiAiProviderProfile>, now: () => number): PiAiAdapter {
  return new PiAiAdapter({
    profiles: () => resolveProfiles(providers),
    resolveApiKey: () => Promise.resolve('test-key'),
    auth: memoryAuth(),
    now,
  })
}

/** Drain one adapter stream so its request reaches the mock server. */
async function drain(adapter: PiAiAdapter, provider: string, model: string): Promise<void> {
  for await (const _chunk of adapter.stream({ provider, model, messages: [] })) {
    // The mock server's response is fully consumed by the loop.
  }
}

describe('peak window selection', () => {
  const windows = [
    { from: '21:00', to: '03:00', timeZone: 'Asia/Tokyo', providers: [{ provider: 'opencode-go' }] },
    { from: '03:00', to: '21:00', timeZone: 'Asia/Tokyo', providers: [{ provider: 'day' }] },
  ]

  it('matches an instant inside an overnight window', () => {
    // 12:00Z is 21:00 JST, the inclusive start.
    expect(selectPeakWindow(windows, Date.UTC(2026, 0, 1, 12, 0))?.providers[0]?.provider).toBe('opencode-go')
    // 00:00Z is 09:00 JST the next day.
    expect(selectPeakWindow(windows, Date.UTC(2026, 0, 2, 0, 0))?.providers[0]?.provider).toBe('day')
  })

  it('treats the window end as exclusive', () => {
    // 18:00Z is 03:00 JST, which the overnight window does not include.
    expect(selectPeakWindow(windows, Date.UTC(2026, 0, 1, 18, 0))?.providers[0]?.provider).toBe('day')
  })

  it('evaluates each window in its own zone', () => {
    const utc = [{ from: '21:00', to: '23:00', timeZone: 'UTC', providers: [{ provider: 'utc-window' }] }]
    expect(selectPeakWindow(utc, Date.UTC(2026, 0, 1, 21, 30))?.providers[0]?.provider).toBe('utc-window')
    expect(selectPeakWindow(utc, Date.UTC(2026, 0, 1, 12, 0))).toBeUndefined()
  })

  it('reads the process zone when a window names none', () => {
    const day = [{ from: '00:00', to: '23:59', providers: [{ provider: 'process-zone' }] }]
    expect(selectPeakWindow(day, Date.UTC(2026, 0, 1, 12, 0))?.providers[0]?.provider).toBe('process-zone')
  })

  it('serves only the listed weekdays, counted from the day the window starts', () => {
    const weekdays = [{
      from: '21:00',
      to: '03:00',
      timeZone: 'Asia/Tokyo',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'] as PiAiPeakDay[],
      providers: [{ provider: 'opencode-go' }],
    }]
    // 2026-01-01 is a Thursday, so 12:00Z is Thursday 21:00 JST.
    expect(selectPeakWindow(weekdays, Date.UTC(2026, 0, 1, 12, 0))?.providers[0]?.provider).toBe('opencode-go')
    // 16:00Z Friday is Saturday 01:00 JST, the tail of Friday's window.
    expect(selectPeakWindow(weekdays, Date.UTC(2026, 0, 2, 16, 0))?.providers[0]?.provider).toBe('opencode-go')
    // 16:00Z Sunday is Monday 01:00 JST, the tail of Sunday's excluded window.
    expect(selectPeakWindow(weekdays, Date.UTC(2026, 0, 4, 16, 0))).toBeUndefined()
    // 12:00Z Saturday is Saturday 21:00 JST, an excluded start day.
    expect(selectPeakWindow(weekdays, Date.UTC(2026, 0, 3, 12, 0))).toBeUndefined()
    expect(selectPeakWindow(weekdays, Date.UTC(2026, 0, 4, 12, 0))).toBeUndefined()
  })

  it('applies a window every day when it lists no days', () => {
    const everyDay = [{
      from: '21:00',
      to: '03:00',
      timeZone: 'Asia/Tokyo',
      days: [],
      providers: [{ provider: 'opencode-go' }],
    }]
    expect(selectPeakWindow(everyDay, Date.UTC(2026, 0, 3, 12, 0))?.providers[0]?.provider).toBe('opencode-go')
  })
})
describe('peak destination validation', () => {
  const ollama = (peak: unknown): Record<string, PiAiProviderProfile> => ({
    'ollama-cloud': { models: [{ id: 'deepseek-v4.1-flash:1017', peak } as never] },
  })

  it('composes the model price policy with the configured destination', () => {
    const profiles = resolveProfiles(ollama([{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }]))
    expect(profiles.get('ollama-cloud')?.peak.get('deepseek-v4.1-flash:1017')).toEqual([{
      from: '12:00',
      to: '18:00',
      timeZone: 'UTC',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      providers: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }])
  })

  it('refuses destinations on a model whose price policy this build does not ship', () => {
    expect(() => resolveProfiles({
      'ollama-cloud': { models: [{ id: 'gemma4:31b', peak: [{ provider: 'opencode-go' }] }] },
    })).toThrow(/ships no published peak window/)
  })

  it('refuses a candidate the installed catalog does not describe', () => {
    expect(() => resolveProfiles(ollama([{ provider: 'not-a-provider' }])))
      .toThrow(/is not an installed pi-ai catalog provider/)
  })

  it('refuses a candidate that does not serve the routed model', () => {
    expect(() => resolveProfiles(ollama([{ provider: 'openai' }])))
      .toThrow(/does not serve "deepseek-v4.1-flash:1017"/)
  })

  it('refuses a candidate that does not serve the model it names', () => {
    expect(() => resolveProfiles(ollama([{ provider: 'openai', model: 'not-a-model' }])))
      .toThrow(/does not serve "not-a-model"/)
  })

  it('accepts a candidate naming another model the provider serves', () => {
    const profiles = resolveProfiles(ollama([{ provider: 'opencode-go', model: 'kimi-k3' }]))
    expect(profiles.get('ollama-cloud')?.peak.get('deepseek-v4.1-flash:1017')).toHaveLength(1)
  })

  it('refuses an empty candidate id', () => {
    expect(() => resolveProfiles(ollama([{ provider: '' }]))).toThrow(/has an empty provider/)
  })

  it('carries the destination through schema validation', () => {
    const parsed = Config({ providers: {
      'ollama-cloud': {
        apiKeyEnv: 'OLLAMA_CLOUD_API_KEY',
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash', apiKeyEnv: 'OPENCODE_GO_API_KEY' }],
        }],
      },
    } }).providers.get()
    const profiles = resolveProfiles(parsed as Record<string, PiAiProviderProfile>)
    expect(profiles.get('ollama-cloud')?.peak.get('deepseek-v4.1-flash:1017')?.[0]?.providers).toEqual([
      { provider: 'opencode-go', model: 'deepseek-v4.1-flash', apiKeyEnv: 'OPENCODE_GO_API_KEY' },
    ])
  })

  it('ignores a period an earlier configuration stored', () => {
    // The schema passes unknown keys through, so a stored window survives
    // validation; resolution overrides it with the model's published policy.
    const parsed = Config({ providers: {
      'ollama-cloud': {
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          peak: [{
            from: '21:00',
            to: '03:00',
            timeZone: 'Asia/Tokyo',
            provider: 'opencode-go',
            model: 'deepseek-v4.1-flash',
          }],
        }],
      },
    } } as never).providers.get() as Record<string, PiAiProviderProfile>
    const [window] = resolveProfiles(parsed).get('ollama-cloud')?.peak.get('deepseek-v4.1-flash:1017') ?? []
    expect(window?.from).toBe('12:00')
    expect(window?.to).toBe('18:00')
    expect(window?.timeZone).toBe('UTC')
  })
})

describe('peak request routing', () => {
  /** Thursday 12:00 UTC, the inclusive start of Ollama Cloud's peak window. */
  const peak = Date.UTC(2026, 0, 1, 12, 0)
  /** Thursday 00:00 UTC, outside it. */
  const offPeak = Date.UTC(2026, 0, 1, 0, 0)
  /** Saturday 12:00 UTC: the UTC weekend Ollama bills at the off-peak rate. */
  const weekend = Date.UTC(2026, 0, 3, 12, 0)

  function routes(primaryURL: string, alternateURL: string): Record<string, PiAiProviderProfile> {
    return {
      'ollama-cloud': {
        apiKeyEnv: 'PI_TEST_KEY',
        baseURL: primaryURL,
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash', apiKeyEnv: 'PI_TEST_KEY' }],
        }],
      },
      'opencode-go': { apiKeyEnv: 'PI_TEST_KEY', baseURL: alternateURL },
    }
  }

  it('dispatches to the destination inside the window and to the route outside it', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const routes_ = routes(primary.url, alternate.url)

    await drain(adapter(routes_, () => peak), 'ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(alternate.requests).toHaveLength(1)
    expect(primary.requests).toHaveLength(0)

    await drain(adapter(routes_, () => offPeak), 'ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(primary.requests).toHaveLength(1)
    expect(alternate.requests).toHaveLength(1)
  })

  it('keeps the route on the UTC weekend the provider prices as off-peak', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])

    await drain(adapter(routes(primary.url, alternate.url), () => weekend), 'ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(primary.requests).toHaveLength(1)
    expect(alternate.requests).toHaveLength(0)
  })

  it('advertises the published window and the destination to selectors', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const pi = adapter(routes(primary.url, alternate.url), () => offPeak)
    const windows = [{
      from: '12:00',
      to: '18:00',
      timeZone: 'UTC',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      provider: 'opencode-go',
      model: 'deepseek-v4.1-flash',
    }]
    const [listed] = await pi.listModels('ollama-cloud')
    expect(listed?.id).toBe('deepseek-v4.1-flash:1017')
    expect(listed?.routing).toEqual({ windows })
    expect((await pi.resolveModel('ollama-cloud', 'deepseek-v4.1-flash:1017')).routing).toEqual({ windows })
  })

  it('dispatches to the model a destination names rather than the routed model', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const providers: Record<string, PiAiProviderProfile> = {
      'ollama-cloud': {
        apiKeyEnv: 'PI_TEST_KEY',
        baseURL: primary.url,
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          peak: [{ provider: 'opencode-go', model: 'kimi-k3', apiKeyEnv: 'PI_TEST_KEY' }],
        }],
      },
      'opencode-go': { apiKeyEnv: 'PI_TEST_KEY', baseURL: alternate.url },
    }

    await drain(adapter(providers, () => peak), 'ollama-cloud', 'deepseek-v4.1-flash:1017')

    expect(primary.requests).toHaveLength(0)
    expect(alternate.requests).toHaveLength(1)
    // The alternate route receives the model the destination named, not the id
    // the session asked its own route for.
    expect(JSON.stringify(alternate.requests[0])).toContain('kimi-k3')
  })

  it('reports the requested route while describing the dispatched model', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const pi = adapter(routes(primary.url, alternate.url), () => peak)
    const prepared = await pi.prepareCall('ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(prepared.model.provider).toBe('ollama-cloud')
    expect(prepared.model.id).toBe('deepseek-v4.1-flash:1017')
  })

  it('serves a destination that is not itself a configured route', async () => {
    const providers: Record<string, PiAiProviderProfile> = {
      'ollama-cloud': {
        apiKeyEnv: 'PI_TEST_KEY',
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          name: 'Primary Name',
          peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
        }],
      },
    }
    const inside = adapter(providers, () => peak)
    expect((await inside.prepareCall('ollama-cloud', 'deepseek-v4.1-flash:1017')).model.name)
      .toBe('DeepSeek V4.1 Flash')

    const outside = adapter(providers, () => offPeak)
    expect((await outside.prepareCall('ollama-cloud', 'deepseek-v4.1-flash:1017')).model.name)
      .toBe('Primary Name')
  })

  /** A primary route whose destination names `opencode-go`, itself configured with its own credential. */
  function credentialRoutes(
    primaryURL: string,
    alternateURL: string,
    candidate: PiAiPeakProvider,
  ): Record<string, PiAiProviderProfile> {
    return {
      'ollama-cloud': {
        apiKeyEnv: 'PI_TEST_KEY',
        baseURL: primaryURL,
        models: [{
          id: 'deepseek-v4.1-flash:1017',
          peak: [{ model: 'deepseek-v4.1-flash', ...candidate }],
        }],
      },
      'opencode-go': { apiKeyEnv: 'PI_ALT_KEY', baseURL: alternateURL },
    }
  }

  it('authenticates a configured destination with that route credential', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const refs: string[] = []
    const pi = new PiAiAdapter({
      profiles: () => resolveProfiles(credentialRoutes(primary.url, alternate.url, { provider: 'opencode-go' })),
      resolveApiKey: (_provider, ref) => {
        if (ref !== undefined) refs.push(ref)
        return Promise.resolve('test-key')
      },
      auth: memoryAuth(),
      now: () => peak,
    })
    await drain(pi, 'ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(alternate.requests).toHaveLength(1)
    expect(refs).toEqual(['PI_ALT_KEY'])
  })

  it('prefers the destination credential reference over the candidate route credential', async () => {
    const primary = await mockServer([{ events: textEvents }])
    const alternate = await mockServer([{ events: textEvents }])
    const refs: string[] = []
    const pi = new PiAiAdapter({
      profiles: () => resolveProfiles(credentialRoutes(primary.url, alternate.url, {
        provider: 'opencode-go',
        apiKeyEnv: 'PI_PEAK_KEY',
      })),
      resolveApiKey: (_provider, ref) => {
        if (ref !== undefined) refs.push(ref)
        return Promise.resolve('test-key')
      },
      auth: memoryAuth(),
      now: () => peak,
    })
    await drain(pi, 'ollama-cloud', 'deepseek-v4.1-flash:1017')
    expect(alternate.requests).toHaveLength(1)
    expect(refs).toEqual(['PI_PEAK_KEY'])
  })
})
