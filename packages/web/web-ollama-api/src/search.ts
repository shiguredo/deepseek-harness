/**
 * `OllamaSearchProvider`: a `WebSearchProvider` backed by Ollama Cloud's
 * `POST /api/web_search`. It maps `results[]` to citeable sources, uses an
 * entry's trimmed `content` as `snippet`, drops entries without a URL, and
 * omits `content` because Ollama Cloud's search response carries no generated answer.
 * @module @deepseek-ai/dsh-web-ollama-api/search
 */

import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'
import {
  dispatchOllamaWeb, hasOllamaCredential, invalidResponse, isRecord, ollamaEndpoint,
  type OllamaWebAuth,
} from './transport.ts'
import type { OllamaResult } from './types.ts'

/** Stable id this provider registers under. */
export const OLLAMA_PROVIDER_ID = 'ollama-cloud'

/** Default number of results requested per search. */
export const OLLAMA_DEFAULT_MAX_RESULTS = 5

/** Authentication, endpoint, and result settings snapshotted for one search. */
export interface OllamaSearchProviderOptions extends OllamaWebAuth {
  /** Search endpoint base or the full `/api/web_search` URL. */
  searchBaseURL: string
  /** Default result count when a request carries no `maxResults`. */
  maxResults: number
}

/**
 * Map one Ollama Cloud result to a normalized source, or `undefined` when it carries
 * no URL (the seam cannot cite an entry without one).
 *
 * @param result - one entry of Ollama Cloud's `results[]`.
 * @returns the normalized source, or `undefined` for an empty URL.
 */
export function mapOllamaResult(result: OllamaResult): WebSearchSource | undefined {
  if (result.url.length === 0) return undefined
  const snippet = result.content?.trim()
  return {
    url: result.url,
    ...result.title != null && result.title.length > 0 ? { title: result.title } : {},
    ...snippet !== undefined && snippet.length > 0 ? { snippet } : {},
  }
}

/**
 * Map an Ollama Cloud response envelope to a normalized search result.
 *
 * @param response - the parsed `POST /api/web_search` response body.
 * @returns the normalized result; URL-less entries are dropped
 *   ({@link mapOllamaResult}).
 */
export function mapOllamaResponse(response: unknown): WebSearchResult {
  if (!isRecord(response)) throw invalidResponse()
  const entries = response.results
  if (entries !== undefined && !Array.isArray(entries)) throw invalidResponse()
  const sources = ((entries ?? []) as OllamaResult[])
    .map(mapOllamaResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  // Ollama Cloud returns no generated answer, so `content` is omitted. The web service owns the
  // final `maxResults` truncation, so this provider reports `truncated: false`.
  return { sources, truncated: false }
}

/** The Ollama Cloud-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class OllamaSearchProvider implements WebSearchProvider {
  readonly id = OLLAMA_PROVIDER_ID

  /**
   * @param resolveOptions - the options for the NEXT search, snapshotted
   * once at each search's entry so one search never mixes two sections. A
   * thunk rather than a value because the plugin's settings section can change
   * between searches.
   */
  constructor(private readonly resolveOptions: () => OllamaSearchProviderOptions) {}

  available(): boolean {
    const options = this.resolveOptions()
    return hasOllamaCredential(options) && URL.canParse(options.searchBaseURL) && isPositiveInteger(options.maxResults)
  }

  search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    // One snapshot for the whole operation: credential resolution awaits, and a
    // settings write landing inside that await must not send the key resolved
    // from the old section to the endpoint named by the new one.
    const options = this.resolveOptions()
    // A per-request bound wins over the configured default; either may be absent.
    const maxResults = request.maxResults ?? options.maxResults
    return dispatchOllamaWeb(options, {
      endpoint: ollamaEndpoint(options.searchBaseURL, 'web_search'),
      body: { query: request.query, max_results: maxResults },
      decode: mapOllamaResponse,
      subject: 'search',
    }, signal)
  }
}

/** True for a result count that can be sent to Ollama Cloud (a positive whole number). */
function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}
