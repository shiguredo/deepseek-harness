/** The `web-ollama-api` settings section layered over the composition entry. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { liveConfig } from '../../../settings/settings/tests/live-config.ts'
import WebRuntime from '@deepseek-ai/dsh-web'
import * as ollamaPlugin from '@deepseek-ai/dsh-web-ollama-api'

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

async function boot() {
  const ctx = new Context()
  await ctx.plugin(WebRuntime, { searchProvider: 'ollama-cloud' })
  const live = await liveConfig(ctx, ollamaPlugin, { apiKey: 'ollama-key', searchBaseURL: 'https://search.entry.test' })
  return { ctx, live }
}

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Run one search and answer the endpoint and body it reached. A fresh `Response`
 * per call because a body can only be read once, and the call history is cleared
 * because repeated `spyOn` returns the same spy.
 * @param ctx - context whose `ctx.web` serves the search.
 * @returns the URL the provider fetched and the parsed request body.
 */
async function searchOnce(ctx: Context): Promise<{ url: string; body: Record<string, unknown> }> {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')
    .mockImplementation(() => Promise.resolve(jsonResponse({ results: [] })))
  fetchSpy.mockClear()
  await ctx.web.search({ query: 'anything' })
  const call = fetchSpy.mock.calls.at(-1)
  const init = call?.[1]
  return {
    url: String((call?.[0] as URL | string | undefined) ?? ''),
    body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {},
  }
}

describe('web-ollama-api settings section', () => {
  it('serves stored endpoint and result-count values to the next search without re-registering the provider', async () => {
    const bench = await boot()
    expect((await searchOnce(bench.ctx)).url).toContain('https://search.entry.test')

    await bench.live.update({ searchBaseURL: 'https://search.stored.test', maxResults: 9 })

    const next = await searchOnce(bench.ctx)
    expect(next.url).toContain('https://search.stored.test')
    expect(next.body['max_results']).toBe(9)
    await bench.ctx.fiber.dispose()
  })
})
