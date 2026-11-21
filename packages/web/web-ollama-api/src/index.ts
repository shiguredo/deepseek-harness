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
  OLLAMA_CREDENTIAL_REF,
  OLLAMA_DEFAULT_BASE_URL,
  type OllamaWebAuth,
} from './transport.ts'

export { OllamaFetchProvider, OLLAMA_FETCH_PROVIDER_ID } from './fetch.ts'
export type { OllamaFetchProviderOptions } from './fetch.ts'
export { mapOllamaResponse, mapOllamaResult, OLLAMA_DEFAULT_MAX_RESULTS, OLLAMA_PROVIDER_ID, OllamaSearchProvider } from './search.ts'
export type { OllamaSearchProviderOptions } from './search.ts'
export {
  OLLAMA_CREDENTIAL_REF, OLLAMA_DEFAULT_BASE_URL, OLLAMA_DEFAULT_FETCH_URL, OLLAMA_DEFAULT_SEARCH_URL,
  ollamaEndpoint,
} from './transport.ts'
export type { OllamaWebAuth, OllamaWebSubject } from './transport.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-ollama-api'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Live plugin config: the one value a deployment varies, editable from the settings page. */
export interface Config {
  /** Default result count when a search request carries no `maxResults`. Defaults to 5. */
  maxResults: Volatile<number>
}

export const Config = z.object({
  maxResults: z.number().step(1).min(1).default(OLLAMA_DEFAULT_MAX_RESULTS).volatile(),
})

/** Settings namespace carrying the default result count. */
export const WEB_SEARCH_OLLAMA_SETTINGS_NAMESPACE = 'web-ollama-api'

/**
 * Project the resolved section into the options both providers serve their next
 * operation with. The endpoints and the credential reference are package
 * constants: Ollama Cloud serves both operations from one host and the model
 * route already stores the key under that reference, so a deployment has
 * nothing to point elsewhere.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @param config - the currently authoritative section.
 * @returns options for one operation.
 */
function resolveOptions(
  ctx: Context, config: { [K in keyof Config]: ReturnType<Config[K]['get']> },
): OllamaWebAuth & { searchBaseURL: string; fetchBaseURL: string; maxResults: number } {
  const apiKeyEnv = credentialRef(OLLAMA_CREDENTIAL_REF)
  return {
    resolveApiKey: async () => {
      const credentials = ctx.get('credentials')
      if (credentials !== undefined) return (await credentials.resolve(apiKeyEnv))?.value
      // Without the seam the environment is the whole credential plane.
      const ambient = launchEnvironmentOf(ctx).get(apiKeyEnv)
      return ambient !== undefined && ambient.value.length > 0 ? ambient.value : undefined
    },
    apiKeyEnv,
    searchBaseURL: OLLAMA_DEFAULT_BASE_URL,
    fetchBaseURL: OLLAMA_DEFAULT_BASE_URL,
    maxResults: config.maxResults,
  }
}

/**
 * Whether the shared credential resolves right now: an entry in the credential
 * store, or a launch-environment value when that service is absent.
 * @param ctx - plugin context supplying the credential and environment planes.
 * @returns whether the next operation would have an API key to send.
 */
async function credentialPresent(ctx: Context): Promise<boolean> {
  const ref = credentialRef(OLLAMA_CREDENTIAL_REF)
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) return (await credentials.describe(ref)).configured
  // Without the seam the environment is the whole credential plane.
  const ambient = launchEnvironmentOf(ctx).get(ref)
  return ambient !== undefined && ambient.value.length > 0
}

/**
 * Register the Ollama Cloud search and fetch providers with `ctx.web` while a
 * credential resolves. Without one the providers stay unregistered, so no
 * provider menu offers a backend whose every operation would fail; storing the
 * key registers them for the next operation, removing it unregisters them.
 * @param ctx - plugin context.
 * @param config - the plugin's live configuration section.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const section = (): { [K in keyof Config]: ReturnType<Config[K]['get']> } => ({ maxResults: config.maxResults.get() })
  const options = () => resolveOptions(ctx, section())
  let unregister: (() => void) | undefined
  let pending: Promise<void> = Promise.resolve()
  /**
   * Match the registry to the credential plane. Serialized through `pending` so
   * two credential events cannot both observe the same stale registration.
   * @returns a promise settling once the registry matches.
   */
  const sync = async (): Promise<void> => {
    const wanted = await credentialPresent(ctx)
    if (wanted === (unregister !== undefined)) return
    if (wanted) {
      const search = ctx.web.registerSearchProvider(new OllamaSearchProvider(options))
      const fetch = ctx.web.registerFetchProvider(new OllamaFetchProvider(options))
      unregister = () => { fetch(); search() }
      return
    }
    const dispose = unregister
    unregister = undefined
    dispose?.()
  }
  ctx.effect(() => () => {
    const dispose = unregister
    unregister = undefined
    dispose?.()
  }, 'web-ollama-api: provider registrations')
  const queue = (): void => {
    pending = pending.then(sync).catch((error: unknown) => { ctx.logger.warn(error) })
  }
  // This row injects `web` only, so it can activate before the row providing
  // `credentials`: the check above would then see the launch environment alone
  // and a key already stored in the credential document would never register
  // either provider. Re-check once that seam arrives.
  ctx.inject(['credentials'], queue)
  // A stored write is the only observable credential change; an ambient one
  // needs a restart because no event reports it.
  ctx.on('credentials/reference-updated', queue)
  await sync()
}
