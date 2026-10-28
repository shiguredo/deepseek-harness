/**
 * Register Ollama Cloud's web capability in `ctx.web`: a search provider over
 * `POST /api/web_search` and a fetch provider over `POST /api/web_fetch`. Both
 * share one API base and one key, because Ollama serves them from one host and
 * authenticates them the same way.
 * @module @deepseek-ai/dsh-web-ollama-api
 */

import type { Volatile } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-web'
import { OllamaFetchProvider } from './fetch.ts'
import { OLLAMA_DEFAULT_MAX_RESULTS, OllamaSearchProvider } from './search.ts'
import {
  OLLAMA_DEFAULT_API_KEY_ENV,
  OLLAMA_DEFAULT_BASE_URL,
  type OllamaWebAuth,
} from './transport.ts'

export { OllamaFetchProvider, OLLAMA_FETCH_PROVIDER_ID } from './fetch.ts'
export type { OllamaFetchProviderOptions } from './fetch.ts'
export { mapOllamaResponse, mapOllamaResult, OLLAMA_DEFAULT_MAX_RESULTS, OLLAMA_PROVIDER_ID, OllamaSearchProvider } from './search.ts'
export type { OllamaSearchProviderOptions } from './search.ts'
export {
  OLLAMA_DEFAULT_API_KEY_ENV, OLLAMA_DEFAULT_BASE_URL, OLLAMA_DEFAULT_FETCH_URL, OLLAMA_DEFAULT_SEARCH_URL,
  ollamaEndpoint,
} from './transport.ts'
export type { OllamaWebAuth, OllamaWebSubject } from './transport.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-ollama-api'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Live plugin config (the settings page edits these references in place). */
export interface Config {
  /** Literal Ollama Cloud API key; prefer {@link apiKeyEnv} so no secret enters configuration files. */
  apiKey: Volatile<string | undefined>
  /** Credential reference resolved for each operation; defaults to `OLLAMA_CLOUD_API_KEY`. */
  apiKeyEnv: Volatile<string>
  /**
   * Search endpoint base or the full `/api/web_search` URL. Falls back to
   * `$OLLAMA_SEARCH_BASE_URL`, then to Ollama Cloud's public base.
   */
  searchBaseURL: Volatile<string | undefined>
  /**
   * Fetch endpoint base or the full `/api/web_fetch` URL. Falls back to
   * `$OLLAMA_FETCH_BASE_URL`, then to Ollama Cloud's public base.
   */
  fetchBaseURL: Volatile<string | undefined>
  /** Default result count when a search request carries no `maxResults`. Defaults to 5. */
  maxResults: Volatile<number>
}

export const Config = z.object({
  apiKey: z.string().role('secret').volatile(),
  apiKeyEnv: z.string().role('credential-ref').default(OLLAMA_DEFAULT_API_KEY_ENV).volatile(),
  // Declared here rather than only at the use site: a configuration surface
  // renders the resolved section, so a default the schema does not carry reads
  // there as no value at all.
  searchBaseURL: z.string().volatile(),
  fetchBaseURL: z.string().volatile(),
  maxResults: z.number().step(1).min(1).default(OLLAMA_DEFAULT_MAX_RESULTS).volatile(),
})

/**
 * Endpoint overrides, independent of any conversation adapter endpoint. Each
 * operation reads its own, so a deployment can point fetch elsewhere without
 * moving search.
 */
const SEARCH_BASE_URL_ENV = 'OLLAMA_SEARCH_BASE_URL'
const FETCH_BASE_URL_ENV = 'OLLAMA_FETCH_BASE_URL'

/** Settings namespace carrying both endpoints and the default result count. */
export const WEB_SEARCH_OLLAMA_SETTINGS_NAMESPACE = 'web-ollama-api'

/**
 * Project one resolved section into the options both providers serve their next
 * operation with. Environment fallbacks stay here rather than in the providers:
 * every value they read is already fully defaulted.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one operation.
 */
function resolveOptions(
  ctx: Context, config: { [K in keyof Config]: ReturnType<Config[K]['get']> },
): OllamaWebAuth & { searchBaseURL: string; fetchBaseURL: string; maxResults: number } {
  const apiKeyEnv = credentialRef(config.apiKeyEnv)
  const literalApiKey = config.apiKey !== undefined && config.apiKey.length > 0
    ? config.apiKey
    : undefined
  return {
    ...literalApiKey === undefined ? {} : { apiKey: literalApiKey },
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      // Without the seam the environment is the whole credential plane.
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    searchBaseURL: config.searchBaseURL
      ?? launchEnvironmentOf(ctx).get(SEARCH_BASE_URL_ENV)?.value
      ?? OLLAMA_DEFAULT_BASE_URL,
    fetchBaseURL: config.fetchBaseURL
      ?? launchEnvironmentOf(ctx).get(FETCH_BASE_URL_ENV)?.value
      ?? OLLAMA_DEFAULT_BASE_URL,
    maxResults: config.maxResults,
  }
}

/** Register the Ollama Cloud search and fetch providers with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  const options = () => resolveOptions(ctx, {
    apiKey: config.apiKey.get(), apiKeyEnv: config.apiKeyEnv.get(), searchBaseURL: config.searchBaseURL.get(),
    fetchBaseURL: config.fetchBaseURL.get(), maxResults: config.maxResults.get(),
  })
  ctx.web.registerSearchProvider(new OllamaSearchProvider(options))
  ctx.web.registerFetchProvider(new OllamaFetchProvider(options))
}
