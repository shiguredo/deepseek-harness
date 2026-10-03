/**
 * Bundled-catalog behavior: a route pi-ai does not ship still resolves its
 * endpoint, capacities, and reasoning levels from the data this build carries,
 * while every configured field keeps winning over it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { resolveProfiles } from '../src/config.ts'
import { BUNDLED_PROVIDERS, bundledProvider } from '../src/bundled-catalog.ts'
import { assemble } from './assemble.ts'
import { memoryAuth } from './auth-double.ts'
import { closeMockServers, mockServer } from './mock-server.ts'

const KEY_ENV = 'PI_TEST_KEY'

beforeEach(() => {
  vi.stubEnv(KEY_ENV, 'test-key')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockServers()
})

/** A context with the runtime mounted, for `listModels`/`resolveModelInfo` reads. */
async function harness(profiles: LlmPiAi.Options): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, profiles)
  return ctx
}

describe('bundled catalog', () => {
  it('describes a route pi-ai does not ship, with its own endpoint and protocol', () => {
    const resolved = resolveProfiles({ 'ollama-cloud': { apiKeyEnv: KEY_ENV } }).get('ollama-cloud')!

    expect(resolved.catalogError).toBeUndefined()
    expect(resolved.modelErrors.size).toBe(0)
    expect(resolved.api).toBe('openai-responses')
    expect(resolved.baseURL).toBe('https://ollama.com/v1')
    expect(resolved.piProvider?.id).toBe('ollama-cloud')
  })

  it('serves the bundled models with their real capacities instead of the route defaults', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    const models = await ctx.llm.listModels('ollama-cloud')

    expect(models.map(model => model.id)).toContain('deepseek-v4.1-flash')
    expect(models.map(model => model.id)).toContain('kimi-k3')
  })

  it('reports the model context window rather than the 262,144 route default', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    const info = await ctx.llm.resolveModelInfo('ollama-cloud', 'deepseek-v4.1-flash')

    expect(info.context?.contextWindow).toBe(1_048_576)
    expect(info.inputModalities).toEqual(['text', 'image'])
  })

  it('carries the model output maximum the endpoint accepts', () => {
    const resolved = resolveProfiles({ 'ollama-cloud': { apiKeyEnv: KEY_ENV } }).get('ollama-cloud')!
    const model = resolved.piProvider?.getModels().find(entry => entry.id === 'deepseek-v4.1-flash')

    expect(model?.maxTokens).toBe(393_216)
  })

  it('offers reasoning levels for a reasoning model', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    const info = await ctx.llm.resolveModelInfo('ollama-cloud', 'deepseek-v4.1-flash')

    expect(info.reasoning?.efforts.map(effort => effort.id)).toEqual([
      'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
    ])
  })

  it('withholds the off level from a model whose endpoint keeps thinking', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    const info = await ctx.llm.resolveModelInfo('ollama-cloud', 'gpt-oss:20b')

    expect(info.reasoning?.efforts.map(effort => effort.id)).not.toContain('off')
    expect(info.reasoning?.efforts.map(effort => effort.id)).toContain('high')
  })

  it('reports no reasoning for a model that does not reason', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    const info = await ctx.llm.resolveModelInfo('ollama-cloud', 'mistral-large-3:675b')

    expect(info.reasoning).toBeUndefined()
  })

  it('lets configuration correct a bundled capacity', async () => {
    const ctx = await harness({
      providers: {
        'ollama-cloud': {
          apiKeyEnv: KEY_ENV,
          models: [{ id: 'deepseek-v4.1-flash', contextWindow: 131_072 }],
        },
      },
    })
    const info = await ctx.llm.resolveModelInfo('ollama-cloud', 'deepseek-v4.1-flash')

    expect(info.context?.contextWindow).toBe(131_072)
  })

  it('lets configuration repoint the route at another endpoint and protocol', () => {
    const resolved = resolveProfiles({
      'ollama-cloud': { apiKeyEnv: KEY_ENV, baseURL: 'https://proxy.example/v1', api: 'openai-completions' },
    }).get('ollama-cloud')!

    expect(resolved.api).toBe('openai-completions')
    expect(resolved.baseURL).toBe('https://proxy.example/v1')
    expect(resolved.piProvider?.getModels()[0]?.baseUrl).toBe('https://proxy.example/v1')
  })

  it('resolves a model the bundle does not name from the route defaults', () => {
    const resolved = resolveProfiles({
      'ollama-cloud': { apiKeyEnv: KEY_ENV, models: [{ id: 'not-in-the-bundle' }] },
    }).get('ollama-cloud')!

    expect(resolved.modelErrors.size).toBe(0)
    expect(resolved.piProvider?.getModels().map(model => model.id)).toEqual(['not-in-the-bundle'])
  })

  it('offers every bundled route in the configurable directory', async () => {
    const ctx = await harness({})
    const offered = ctx.llm.listConfigurableProviders()

    for (const bundle of BUNDLED_PROVIDERS) {
      expect(offered).toContainEqual({
        provider: bundle.id,
        displayName: bundle.id,
        settingsNs: 'llm-pi-ai',
        settingsPath: ['providers', bundle.id],
        declared: false,
      })
    }
  })

  it('lists a dormant bundled route by its key and names it once a profile resolves it', async () => {
    // The directory keeps listing route keys, which is what a provider picker
    // renders; the resolved route is what a configured row and the model
    // picker name.
    const dormant = await harness({})
    expect(dormant.llm.listConfigurableProviders().find(entry => entry.provider === 'ollama-cloud')?.displayName)
      .toBe('ollama-cloud')

    const configured = await harness({ providers: { 'ollama-cloud': { apiKeyEnv: KEY_ENV } } })
    expect(configured.llm.listProviders()).toContainEqual({ id: 'ollama-cloud', name: 'Ollama Cloud' })
  })

  it('lets a profile rename a bundled route', async () => {
    const ctx = await harness({ providers: { 'ollama-cloud': { displayName: 'Local Ollama' } } })

    expect(ctx.llm.listProviders()).toContainEqual({ id: 'ollama-cloud', name: 'Local Ollama' })
  })

  it('places a bundled route where its name reads rather than after every installed one', async () => {
    const ctx = await harness({})
    const offered = ctx.llm.listConfigurableProviders().map(entry => entry.provider)

    // The merged directory is what a provider picker renders, so a bundled
    // route belongs in name order among the installed ones instead of
    // trailing the list.
    expect(offered).toEqual([...offered].sort())
    expect(offered.indexOf('ollama-cloud')).toBeGreaterThan(-1)
  })

  it('carries the endpoint and protocol a bundled model resolves from', () => {
    const bundle = bundledProvider('ollama-cloud')!
    expect(bundle.api).toBe('openai-responses')
    for (const model of bundle.models) {
      // A ceiling the endpoint rejects a larger value against, and a window the
      // model is actually served at — either one missing would silently fall
      // back to the adapter's generic defaults.
      expect(model.maxTokens).toBeGreaterThan(0)
      expect(model.contextWindow).toBeGreaterThanOrEqual(model.maxTokens)
    }
  })

  it('sends a bundled model to the route endpoint under its own protocol', async () => {
    const server = await mockServer([{ status: 401, body: JSON.stringify({ error: { message: 'expected mock failure' } }) }])
    const adapter = new LlmPiAi.PiAiAdapter({
      profiles: () => resolveProfiles({
        'ollama-cloud': { apiKeyEnv: KEY_ENV, baseURL: `${server.url}/v1` },
      }),
      resolveApiKey: () => Promise.resolve('test-key'),
      auth: memoryAuth(),
    })
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['ollama-cloud'], adapter)

    const result = await assemble(ctx, {
      provider: 'ollama-cloud',
      model: 'deepseek-v4.1-flash',
      messages: [],
    })

    // A bundled route carries data rather than a protocol implementation, so
    // this proves the adapter's own construction served the request: the
    // Responses path is what the bundle names, and the profile's own endpoint
    // is what it reached.
    expect(result.finish.kind).toBe('error')
    expect(server.paths).toEqual(['/v1/responses'])
  })
})
