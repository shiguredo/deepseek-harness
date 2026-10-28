import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_MAX_RESULTS,
  OLLAMA_PROVIDER_ID,
  OllamaSearchProvider,
  type OllamaSearchProviderOptions,
} from '@deepseek-ai/dsh-web-ollama-api'
import * as ollamaPlugin from '@deepseek-ai/dsh-web-ollama-api'
import { mapOllamaResponse, mapOllamaResult } from '../src/search.ts'

const options: OllamaSearchProviderOptions = { apiKey: 'ollama-key', searchBaseURL: 'https://ollama.test', maxResults: 5 }

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

/** A response whose body stream aborts before any JSON reaches the reader. */
function abortedResponse(status: number): Response {
  return new Response(new ReadableStream({
    start(controller) { controller.error(new DOMException('aborted', 'AbortError')) },
  }), { status, headers: { 'content-type': 'application/json' } })
}

/** Construct the provider over a fixed options value; production passes a live thunk. */
const providerOf = (value: OllamaSearchProviderOptions): OllamaSearchProvider =>
  new OllamaSearchProvider(() => value)

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The JSON body one mocked fetch call posted. */
function postedBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') throw new Error('the provider must post a JSON string body')
  return JSON.parse(init.body)
}

describe('Ollama result mapping', () => {
  it('maps a full result entry with a trimmed snippet', () => {
    expect(mapOllamaResult({
      url: 'https://a.test',
      title: 'A',
      content: '  page excerpt  ',
    })).toEqual({ url: 'https://a.test', title: 'A', snippet: 'page excerpt' })
  })

  it('drops an entry with an empty URL', () => {
    expect(mapOllamaResult({ url: '', title: 'A', content: 'x' })).toBeUndefined()
  })

  it('omits null/empty optional fields and a blank snippet rather than emitting them', () => {
    expect(mapOllamaResult({ url: 'https://a.test', title: null, content: null }))
      .toEqual({ url: 'https://a.test' })
    expect(mapOllamaResult({ url: 'https://a.test', title: '', content: '   ' }))
      .toEqual({ url: 'https://a.test' })
  })

  it('maps a response to a result with no content and filtered sources', () => {
    const result = mapOllamaResponse({
      results: [
        { url: 'https://a.test', content: 'one' },
        { url: '' },
        { url: 'https://c.test', title: 'C', content: 'three' },
      ],
    })
    expect(result).toEqual({
      sources: [
        { url: 'https://a.test', snippet: 'one' },
        { url: 'https://c.test', title: 'C', snippet: 'three' },
      ],
      truncated: false,
    })
    expect(result.content).toBeUndefined()
  })

  it('tolerates a missing results array', () => {
    expect(mapOllamaResponse({}).sources).toEqual([])
  })
})

describe('OllamaSearchProvider availability', () => {
  it('is unavailable without a key or resolver', () => {
    expect(providerOf({ ...options, apiKey: '' }).available()).toBe(false)
  })

  it('is available with a literal key', () => {
    expect(providerOf(options).available()).toBe(true)
  })

  it('is available with a resolver even before a key resolves', () => {
    expect(providerOf({ ...options, apiKey: '', resolveApiKey: () => Promise.resolve(undefined) }).available()).toBe(true)
  })

  it('is misconfigured when the base URL is unparseable', () => {
    expect(providerOf({ ...options, searchBaseURL: 'not a url' }).available()).toBe(false)
  })

  it('is misconfigured when maxResults is not a positive integer', () => {
    expect(providerOf({ ...options, maxResults: 0 }).available()).toBe(false)
    expect(providerOf({ ...options, maxResults: 1.5 }).available()).toBe(false)
  })
})

describe('OllamaSearchProvider request mapping', () => {
  it('posts the query and result count with bearer auth', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [{ url: 'https://a.test', content: 'hi' }] }))
    vi.stubGlobal('fetch', fetchMock)

    await providerOf(options).search({ query: 'hello' })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://ollama.test/api/web_search')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ollama-key')
    expect(postedBody(init)).toEqual({ query: 'hello', max_results: 5 })
  })

  it('uses a configured full endpoint as-is instead of appending the operation path twice', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await providerOf({ ...options, searchBaseURL: 'https://ollama.test/api/web_search' }).search({ query: 'q' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ollama.test/api/web_search')
  })

  it('lets a request maxResults win over the configured default', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await providerOf({ ...options, maxResults: 7 }).search({ query: 'q', maxResults: 2 })
    expect(postedBody(fetchMock.mock.calls[0]?.[1])).toMatchObject({ max_results: 2 })
  })

  it('forwards the abort signal', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    await providerOf(options).search({ query: 'q' }, controller.signal)
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})

describe('OllamaSearchProvider error handling', () => {
  it('maps an HTTP error to WEB_PROVIDER_ERROR with the provider detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'bad key' }, { status: 401 })))
    const error = await providerOf(options).search({ query: 'q' }).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    expect((error as Error).message).toContain('Ollama Cloud API error (HTTP 401): bad key')
  })

  it('reads a `message` detail when `error` is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'rate limited' }, { status: 429 })))
    const error = await providerOf(options).search({ query: 'q' }).catch((caught: unknown) => caught)
    expect((error as Error).message).toContain('Ollama Cloud API error (HTTP 429): rate limited')
  })

  it('keeps the status-line message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('gateway down', { status: 502 })))
    const error = await providerOf(options).search({ query: 'q' }).catch((caught: unknown) => caught)
    expect((error as Error).message).toContain('Ollama Cloud API error (HTTP 502)')
  })

  it('names the endpoint and settings page on every post-dispatch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { status: 500 })))
    const error = await providerOf(options).search({ query: 'q' }).catch((caught: unknown) => caught)
    expect((error as Error).message).toContain('used endpoint "https://ollama.test/api/web_search"')
    expect((error as Error).message).toContain('Settings > Plugins > Ollama Cloud search')
  })

  it('maps a network failure to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('connection refused'))))
    await expect(providerOf(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('maps an abort to WEB_ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))))
    await expect(providerOf(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('maps an unparseable success body to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })))
    await expect(providerOf(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('surfaces an abort during success-body parse as WEB_ABORTED, not provider error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => abortedResponse(200)))
    await expect(providerOf(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })

  it('surfaces an abort during error-body parse as WEB_ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => abortedResponse(500)))
    await expect(providerOf(options).search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_ABORTED' }))
  })
})

describe('web-ollama-api plugin registration', () => {
  it('registers the provider into ctx.web and withdraws it with the fiber', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: [] })))
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: OLLAMA_PROVIDER_ID })
    const fiber = await ctx.plugin(ollamaPlugin, { apiKey: 'ollama-key' })
    await expect(ctx.web.search({ query: 'q' })).resolves.toMatchObject({ sources: [], truncated: false })
    await fiber.dispose()
    await expect(ctx.web.search({ query: 'q' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_CONFIGURED_MISSING' }))
  })

  it('has no default export (namespace plugin export shape)', () => {
    expect('default' in ollamaPlugin).toBe(false)
  })

  it('threads the configured maxResults and search endpoint into the request', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { searchProvider: OLLAMA_PROVIDER_ID })
    const fiber = await ctx.plugin(ollamaPlugin, { apiKey: 'ollama-key', searchBaseURL: 'https://proxy.test', maxResults: 9 })
    await ctx.web.search({ query: 'q' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://proxy.test/api/web_search')
    expect(postedBody(init)).toMatchObject({ max_results: 9 })
    await fiber.dispose()
  })

  it('falls back to $OLLAMA_CLOUD_API_KEY and the default base URL when config omits them', async () => {
    const prev = process.env.OLLAMA_CLOUD_API_KEY
    process.env.OLLAMA_CLOUD_API_KEY = 'env-key'
    try {
      const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ results: [] }))
      vi.stubGlobal('fetch', fetchMock)
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { searchProvider: OLLAMA_PROVIDER_ID })
      ollamaPlugin.apply(ctx, ollamaPlugin.Config({}))
      await ctx.web.search({ query: 'q' })
      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe(`${OLLAMA_DEFAULT_BASE_URL}/api/web_search`)
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer env-key')
      expect(postedBody(init)).toMatchObject({ max_results: OLLAMA_DEFAULT_MAX_RESULTS })
      await ctx.fiber.dispose()
    } finally {
      if (prev === undefined) delete process.env.OLLAMA_CLOUD_API_KEY
      else process.env.OLLAMA_CLOUD_API_KEY = prev
    }
  })

  it('reports an actionable credential error when neither config nor env supplies a key', async () => {
    const prev = process.env.OLLAMA_CLOUD_API_KEY
    delete process.env.OLLAMA_CLOUD_API_KEY
    try {
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { searchProvider: OLLAMA_PROVIDER_ID })
      await ctx.plugin(ollamaPlugin, {})
      const error = await ctx.web.search({ query: 'q' }).catch((caught: unknown) => caught)
      expect(error).toMatchObject({ code: 'WEB_PROVIDER_CREDENTIAL_MISSING' })
      expect((error as Error).message).toMatch(/store it through the credentials service.*Ollama Cloud search settings page/s)
    } finally {
      if (prev !== undefined) process.env.OLLAMA_CLOUD_API_KEY = prev
    }
  })
})
