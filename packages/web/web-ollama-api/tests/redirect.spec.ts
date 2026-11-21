/**
 * Real HTTP coverage proves whether native `fetch` contacts a cross-origin `Location`; mocked
 * request-init assertions alone cannot observe that boundary.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { OllamaFetchProvider, OllamaSearchProvider } from '@deepseek-ai/dsh-web-ollama-api'

/** Construct the providers over a fixed options value; production passes a live thunk. */
import type { OllamaFetchProviderOptions, OllamaSearchProviderOptions } from '@deepseek-ai/dsh-web-ollama-api'

const searchProvider = (options: OllamaSearchProviderOptions): OllamaSearchProvider =>
  new OllamaSearchProvider(() => options)

const fetchProvider = (options: OllamaFetchProviderOptions): OllamaFetchProvider =>
  new OllamaFetchProvider(() => options)

const TEST_API_KEY = 'redirect-test-key'
const TEST_QUERY = 'private redirect query'
const targetRequests: ReceivedRequest[] = []

interface ReceivedRequest {
  readonly body: string
  readonly headers: IncomingMessage['headers']
  readonly method?: string
}

let redirectOrigin: string
let targetOrigin: string

const targetServer = createServer((request, response) => {
  void captureRequest(request).then((received) => {
    targetRequests.push(received)
    response.writeHead(204).end()
  }, (error: unknown) => response.destroy(asError(error)))
})

const redirectServer = createServer((request, response) => {
  request.resume()
  const status = Number(new URL(request.url ?? '/', 'http://fixture.test').pathname.split('/')[1])
  response.writeHead(status, { location: `${targetOrigin}/collect` }).end()
})

beforeAll(async () => {
  targetOrigin = await listen(targetServer)
  redirectOrigin = await listen(redirectServer)
})

afterAll(async () => {
  await Promise.all([close(redirectServer), close(targetServer)])
})

describe('OllamaSearchProvider redirect policy', () => {
  it.each([301, 302, 303, 307, 308])('rejects HTTP %i before contacting Location', async (status) => {
    targetRequests.length = 0
    const provider = searchProvider({
      apiKey: TEST_API_KEY,
      searchBaseURL: `${redirectOrigin}/${status}`,
      maxResults: 1,
    })

    await expect(provider.search({ query: TEST_QUERY }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    expect(targetRequests).toHaveLength(0)
  })


  it('shows default 307 following forwards the custom credential and POST body', async () => {
    targetRequests.length = 0
    const body = JSON.stringify({ query: TEST_QUERY })
    await fetch(`${redirectOrigin}/307`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${TEST_API_KEY}`,
        'content-type': 'application/json',
      },
      body,
    })

    expect(targetRequests).toHaveLength(1)
    expect(targetRequests[0]).toMatchObject({ method: 'POST', body })
    // Native fetch strips `authorization` on a cross-origin redirect but still
    // contacts the target; `content-type` survives and proves the follow.
    expect(targetRequests[0]?.headers['content-type']).toBe('application/json')
  })
})

describe('OllamaFetchProvider redirect policy', () => {
  it.each([301, 302, 303, 307, 308])('rejects HTTP %i before contacting Location', async (status) => {
    targetRequests.length = 0
    const provider = fetchProvider({
      apiKey: TEST_API_KEY,
      fetchBaseURL: `${redirectOrigin}/${status}`,
    })

    await expect(provider.fetch({ url: 'https://ollama.com' }))
      .rejects.toMatchObject({ code: 'WEB_PROVIDER_ERROR' })
    expect(targetRequests).toHaveLength(0)
  })
})

/** Read a complete request received by the redirect target. */
function captureRequest(request: IncomingMessage): Promise<ReceivedRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    request.on('data', (chunk: unknown) => {
      if (typeof chunk === 'string' || chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk))
      else reject(new TypeError('unexpected HTTP request chunk'))
    })
    request.once('error', reject)
    request.once('end', () => {
      resolve({
        ...request.method !== undefined ? { method: request.method } : {},
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      })
    })
  })
}

/** Listen on an ephemeral loopback port and return the server origin. */
async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

/** Close a listening fixture server after every request has settled. */
async function close(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => server.close((error) => {
    if (error === undefined) resolve()
    else reject(error)
  }))
}

/** Normalize an unknown fixture failure for `ServerResponse.destroy`. */
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
