import { describe, expect, it } from 'vitest'
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_MAX_RESULTS,
  OllamaSearchProvider,
} from '@deepseek-ai/dsh-web-ollama-api'

/** Construct the provider over a fixed options value; production passes a live thunk. */
import type { OllamaSearchProviderOptions } from '@deepseek-ai/dsh-web-ollama-api'

const searchProvider = (options: OllamaSearchProviderOptions): OllamaSearchProvider =>
  new OllamaSearchProvider(() => options)

/**
 * Disabled real-API probe for the Ollama search provider. Its body remains
 * because mocks cannot confirm the wire shape.
 */
const apiKey = process.env.OLLAMA_CLOUD_API_KEY
const maybe = apiKey !== undefined && apiKey.length > 0 ? describe : describe.skip

maybe('OllamaSearchProvider real API', () => {
  it.skip('returns citeable sources for a live query', async () => {
    const provider = searchProvider({
      apiKey: apiKey!,
      searchBaseURL: process.env.OLLAMA_SEARCH_BASE_URL ?? OLLAMA_DEFAULT_BASE_URL,
      maxResults: OLLAMA_DEFAULT_MAX_RESULTS,
    })
    const result = await provider.search({ query: 'WebRTC SFU Sora', maxResults: 3 })
    expect(result.sources.length).toBeGreaterThan(0)
    for (const source of result.sources) expect(source.url).toMatch(/^https?:\/\//)
  }, 60_000)
})
