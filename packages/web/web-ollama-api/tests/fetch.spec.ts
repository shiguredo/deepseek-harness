import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebRuntime from '@deepseek-ai/dsh-web'
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_FETCH_PROVIDER_ID,
  OllamaFetchProvider,
  type OllamaFetchProviderOptions,
} from '@deepseek-ai/dsh-web-ollama-api'
import * as ollamaPlugin from '@deepseek-ai/dsh-web-ollama-api'

const options: OllamaFetchProviderOptions = { apiKey: 'ollama-key', fetchBaseURL: 'https://ollama.test' }

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init })
}

/** Construct the provider over a fixed options value; production passes a live thunk. */
const providerOf = (value: OllamaFetchProviderOptions): OllamaFetchProvider =>
  new OllamaFetchProvider(() => value)

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The JSON body one mocked fetch call posted. */
function postedBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') throw new Error('the provider must post a JSON string body')
  return JSON.parse(init.body)
}

describe('OllamaFetchProvider', () => {
  it('posts the URL to /api/web_fetch and returns its Markdown body', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({
      title: 'Ollama',
      content: '[Cloud models](https://ollama.com/blog/cloud-models) are now available.',
      links: ['https://ollama.com/'],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await providerOf(options).fetch({ url: 'https://ollama.com' })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://ollama.test/api/web_fetch')
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ollama-key')
    expect(postedBody(init)).toEqual({ url: 'https://ollama.com' })
    // The API reports no final URL, so the result names the requested one.
    expect(result).toEqual({
      url: 'https://ollama.com',
      statusCode: 200,
      body: { kind: 'text', content: '[Cloud models](https://ollama.com/blog/cloud-models) are now available.' },
      truncated: false,
    })
  })

  it('uses a configured full endpoint as-is instead of appending the operation path twice', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ content: 'body' }))
    vi.stubGlobal('fetch', fetchMock)
    await providerOf({ ...options, fetchBaseURL: 'https://ollama.test/api/web_fetch' }).fetch({ url: 'https://a.test' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://ollama.test/api/web_fetch')
  })

  it('reports its own endpoint and settings page on a post-dispatch failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'nope' }, { status: 500 })))
    const error = await providerOf(options).fetch({ url: 'https://a.test' }).catch((caught: unknown) => caught)
    expect((error as Error).message).toContain('Ollama Cloud API error (HTTP 500)')
    expect((error as Error).message).toContain('used endpoint "https://ollama.test/api/web_fetch"')
    expect((error as Error).message).toContain('Settings > Plugins > Ollama Cloud search')
  })

  it('maps a network failure to WEB_PROVIDER_ERROR and a cancellation to WEB_ABORTED', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('connection refused'))))
    await expect(providerOf(options).fetch({ url: 'https://a.test' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))))
    const aborted = await providerOf(options).fetch({ url: 'https://a.test' }).catch((caught: unknown) => caught)
    expect(aborted).toMatchObject({ code: 'WEB_ABORTED', message: 'Ollama Cloud web request aborted' })
  })

  it('maps a body without page content to WEB_PROVIDER_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ title: 'no content' })))
    await expect(providerOf(options).fetch({ url: 'https://a.test' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('is unavailable without a credential or with an unparseable endpoint', () => {
    expect(providerOf({ ...options, apiKey: '' }).available()).toBe(false)
    expect(providerOf({ ...options, fetchBaseURL: 'not a url' }).available()).toBe(false)
    expect(providerOf(options).available()).toBe(true)
  })

  it('registers as ollama-cloud-fetch and resolves through the web service', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ content: '# Page' }))
    vi.stubGlobal('fetch', fetchMock)
    const ctx = new Context()
    await ctx.plugin(WebRuntime, { fetchProvider: OLLAMA_FETCH_PROVIDER_ID })
    const fiber = await ctx.plugin(ollamaPlugin, { apiKey: 'ollama-key' })
    const result = await ctx.web.fetch({ url: 'https://a.test' })
    expect(result.body).toEqual({ kind: 'text', content: '# Page' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${OLLAMA_DEFAULT_BASE_URL}/api/web_fetch`)
    await fiber.dispose()
  })

  it('reads its own environment endpoint, independently of the search one', async () => {
    const previous = process.env.OLLAMA_FETCH_BASE_URL
    process.env.OLLAMA_FETCH_BASE_URL = 'https://fetch-env.test'
    try {
      const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => jsonResponse({ content: 'body' }))
      vi.stubGlobal('fetch', fetchMock)
      const ctx = new Context()
      await ctx.plugin(WebRuntime, { fetchProvider: OLLAMA_FETCH_PROVIDER_ID })
      ollamaPlugin.apply(ctx, ollamaPlugin.Config({ apiKey: 'k' }))
      await ctx.web.fetch({ url: 'https://a.test' })
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://fetch-env.test/api/web_fetch')
      await ctx.fiber.dispose()
    } finally {
      if (previous === undefined) delete process.env.OLLAMA_FETCH_BASE_URL
      else process.env.OLLAMA_FETCH_BASE_URL = previous
    }
  })
})
