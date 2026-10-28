/**
 * A peak window may name a route another adapter owns. The LLM service
 * dispatches the request there, while the configured route keeps the Session
 * identity and the destination route resolves its own credential.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import * as DeepSeek from '@deepseek-ai/dsh-llm-deepseek-api-key'
import { assemble } from './assemble.ts'
import { anthropicTextEvents, closeMockServers, mockServer, textEvents } from './mock-server.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await closeMockServers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** Thursday 12:00 UTC, the inclusive start of Ollama Cloud's published peak window. */
const PEAK = Date.UTC(2026, 0, 1, 12, 0)
/** Thursday 00:00 UTC, outside it. */
const OFF_PEAK = Date.UTC(2026, 0, 1, 0, 0)

/** The one user message every request in this file sends. */
const MESSAGES = [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'hi' }] })]

/**
 * Compose the pi-ai route with the native DeepSeek route as the window's
 * destination, each pointed at its own mock endpoint and credential reference.
 * @param now - epoch milliseconds the peak window is evaluated at.
 * @returns the runtime and both mock endpoints.
 */
async function composition(now: number) {
  vi.stubEnv('PEAK_PRIMARY_KEY', 'primary-key')
  vi.stubEnv('PEAK_DESTINATION_KEY', 'destination-key')
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const primary = await mockServer([{ events: textEvents }, { events: textEvents }])
  const destination = await mockServer([{ events: anthropicTextEvents }, { events: anthropicTextEvents }])
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, { providers: {
    'ollama-cloud': {
      // The routed protocol is not what this test observes; completions frames
      // keep the primary endpoint's script minimal.
      api: 'openai-completions',
      baseURL: primary.url,
      apiKeyEnv: 'PEAK_PRIMARY_KEY',
      models: [{
        id: 'deepseek-v4.1-flash:1017',
        peak: [{ provider: 'deepseek-official', model: 'deepseek-flash' }],
      }],
    },
  } })
  await ctx.plugin(DeepSeek, {
    baseURL: destination.url,
    apiKeyEnv: 'PEAK_DESTINATION_KEY',
    models: [{ id: 'deepseek-flash' }],
    thinking: 'disabled',
  })
  return { ctx, primary, destination }
}

describe('peak destination on another adapter', () => {
  it('dispatches to the destination route inside the window under the configured identity', async () => {
    const { ctx, primary, destination } = await composition(PEAK)
    const result = await assemble(ctx, { provider: 'ollama-cloud', model: 'deepseek-v4.1-flash:1017', messages: MESSAGES })

    expect(result.finish).toEqual({ kind: 'stop' })
    expect(destination.requests).toHaveLength(1)
    expect(primary.requests).toHaveLength(0)
    // The Session keeps the configured route; only the wire request moved.
    expect(result.message.source).toMatchObject({ provider: 'ollama-cloud', model: 'deepseek-v4.1-flash:1017' })
    expect(JSON.stringify(destination.requests[0])).toContain('deepseek-flash')
    // The destination authenticates through its own profile, not the window's route.
    expect(destination.headers[0]?.['x-api-key']).toBe('destination-key')
  })

  it('keeps the configured route outside the window', async () => {
    const { ctx, primary, destination } = await composition(OFF_PEAK)
    const result = await assemble(ctx, { provider: 'ollama-cloud', model: 'deepseek-v4.1-flash:1017', messages: MESSAGES })

    expect(result.finish).toEqual({ kind: 'stop' })
    expect(primary.requests).toHaveLength(1)
    expect(destination.requests).toHaveLength(0)
    expect(result.message.source).toMatchObject({ provider: 'ollama-cloud', model: 'deepseek-v4.1-flash:1017' })
    expect(primary.headers[0]?.authorization).toBe('Bearer primary-key')
  })
})
