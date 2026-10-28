/**
 * `OllamaFetchProvider`: a `WebFetchProvider` backed by Ollama Cloud's
 * `POST /api/web_fetch`, the fetch half of the same web capability the search
 * provider uses. One request per fetch, no model request.
 * @module @deepseek-ai/dsh-web-ollama-api/fetch
 */

import type { WebFetchProvider, WebFetchRequest, WebFetchResult } from '@deepseek-ai/dsh-web'
import {
  dispatchOllamaWeb, hasOllamaCredential, invalidResponse, isRecord, ollamaEndpoint,
  type OllamaWebAuth,
} from './transport.ts'

/** Stable id this provider registers under in the fetch registry. */
export const OLLAMA_FETCH_PROVIDER_ID = 'ollama-cloud-fetch'

/** Authentication and endpoint values snapshotted for one fetch. */
export interface OllamaFetchProviderOptions extends OllamaWebAuth {
  /** Fetch endpoint base or the full `/api/web_fetch` URL. */
  fetchBaseURL: string
}

/**
 * Fetch one page through the Ollama Cloud web API. The API reports neither the
 * target's status nor a final redirect URL, and it fails when the page yields
 * no content, so a success is the requested page retrieved with HTTP 200.
 */
export class OllamaFetchProvider implements WebFetchProvider {
  readonly id = OLLAMA_FETCH_PROVIDER_ID

  /**
   * @param resolveOptions - the options for the NEXT fetch, snapshotted once at
   * each fetch's entry so one fetch never mixes two settings sections.
   */
  constructor(private readonly resolveOptions: () => OllamaFetchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return hasOllamaCredential(options) && URL.canParse(options.fetchBaseURL)
  }

  fetch(request: WebFetchRequest, signal?: AbortSignal): Promise<WebFetchResult> {
    const options = this.resolveOptions()
    return dispatchOllamaWeb(options, {
      endpoint: ollamaEndpoint(options.fetchBaseURL, 'web_fetch'),
      body: { url: request.url },
      decode: (payload): WebFetchResult => {
        if (!isRecord(payload) || typeof payload.content !== 'string') throw invalidResponse()
        return {
          url: request.url,
          statusCode: 200,
          body: { kind: 'text', content: payload.content },
          truncated: false,
        }
      },
      subject: 'fetch',
    }, signal)
  }
}
