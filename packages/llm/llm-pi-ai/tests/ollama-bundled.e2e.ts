/**
 * Real-API verification that a bundled route drives Ollama Cloud as described:
 * models list, context capacity, and that a selected reasoning level actually
 * changes what the endpoint is asked for. Self-skips without a credential.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { resolveProfiles } from '../src/config.ts'
import { assemble } from './assemble.ts'

const apiKey = process.env.OLLAMA_API_KEY
const model = process.env.DSH_PI_AI_OLLAMA_MODEL ?? 'deepseek-v4.1-flash'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

async function harness(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, { providers: { 'ollama-cloud': { apiKeyEnv: 'OLLAMA_API_KEY' } } })
  return ctx
}

describe.skipIf(apiKey === undefined)('llm-pi-ai bundled Ollama Cloud e2e', () => {
  it('serves the bundled catalog with real capacities', async () => {
    const ctx = await harness()
    const models = await ctx.llm.listModels('ollama-cloud')
    expect(models.map(entry => entry.id)).toContain(model)

    const info = await ctx.llm.resolveModelInfo('ollama-cloud', model)
    expect(info.context?.contextWindow).toBe(1_048_576)
    expect(info.reasoning?.efforts.map(effort => effort.id)).toContain('high')
  })

  it('streams text and native replay metadata through the Responses protocol', async () => {
    const ctx = await harness()
    const result = await assemble(ctx, {
      provider: 'ollama-cloud',
      model,
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'Reply with exactly the word: pong' }],
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })],
      maxTokens: 1024,
    })

    expect(result.finish.kind).toBe('stop')
    const text = result.message.content.filter(block => block.type === 'text').map(block => block.text).join('')
    expect(text.toLowerCase()).toContain('pong')
    expect(result.message.source.kind === 'model' ? result.message.source.replayState : undefined).toMatchObject({
      response: { kind: 'pi-ai', api: 'openai-responses', provider: 'ollama-cloud', model },
    })
  })

  it('sends the selected reasoning level the bundle declares for the effort', async () => {
    const ctx = await harness()
    // A level only a reasoning model accepts: the request fails resolution
    // before any network call when the bundle did not declare it.
    const result = await assemble(ctx, {
      provider: 'ollama-cloud',
      model,
      messages: [createUserMessage({
        content: [{ type: 'text', text: 'What is 17*23? Answer with the number.' }],
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      })],
      reasoningEffort: ReasoningEffortId('max'),
      maxTokens: 2048,
    })

    expect(result.finish.kind).toBe('stop')
  })

  it('resolves a profile that names only a credential', () => {
    const resolved = resolveProfiles({ 'ollama-cloud': { apiKeyEnv: 'OLLAMA_API_KEY' } }).get('ollama-cloud')!
    expect(resolved.baseURL).toBe('https://ollama.com/v1')
    expect(resolved.catalogError).toBeUndefined()
    expect(resolved.modelErrors.size).toBe(0)
  })
})
