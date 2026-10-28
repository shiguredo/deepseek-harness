/**
 * Authentication and redirect-rejecting transport shared by the Ollama Cloud
 * search and fetch providers in this package. One API base and one key serve
 * both operations, so credential resolution, the dispatch call, and the
 * cancellation helpers live once, here.
 * @module @deepseek-ai/dsh-web-ollama-api/transport
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { OllamaError } from './types.ts'

/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = 'deepseek-harness/0.0.1'

/** Default Ollama Cloud API base both operations append their path to. */
export const OLLAMA_DEFAULT_BASE_URL = 'https://ollama.com'

/** Effective search endpoint when a deployment configures no base of its own. */
export const OLLAMA_DEFAULT_SEARCH_URL = `${OLLAMA_DEFAULT_BASE_URL}/api/web_search`

/** Effective fetch endpoint when a deployment configures no base of its own. */
export const OLLAMA_DEFAULT_FETCH_URL = `${OLLAMA_DEFAULT_BASE_URL}/api/web_fetch`

/**
 * Resolve one operation's absolute endpoint from a configured value. A
 * deployment may give the shared base or that operation's full URL; a full URL
 * is kept instead of having the path appended twice.
 * @param configured - the configured base or full endpoint.
 * @param operation - the Ollama Cloud path segment, without `/api/`.
 * @returns the absolute dispatch URL.
 */
export function ollamaEndpoint(configured: string, operation: 'web_search' | 'web_fetch'): string {
  const suffix = `/api/${operation}`
  const trimmed = configured.replace(/\/+$/u, '')
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`
}

/** Default credential reference resolved for each operation. */
export const OLLAMA_DEFAULT_API_KEY_ENV = 'OLLAMA_CLOUD_API_KEY'

/** Authentication and endpoint values resolved once for an operation. */
export interface OllamaWebAuth {
  /** Literal Ollama Cloud API key; when present it wins over {@link resolveApiKey}. */
  apiKey?: string
  /** Resolve the current Ollama Cloud API key for one operation. */
  resolveApiKey?: () => Promise<string | undefined>
  /** Credential reference named by missing-credential diagnostics. */
  apiKeyEnv?: CredentialRef
}

/** Which capability of the Ollama Cloud web provider an operation belongs to. */
export type OllamaWebSubject = 'search' | 'fetch'

/** One fully resolved Ollama Cloud request. */
export interface OllamaWebRequest<T> {
  /** Absolute dispatch URL. */
  endpoint: string
  /** JSON request body. */
  body: object
  /** Validate and project the response. */
  decode: (payload: unknown) => T
  /** Operation named by the failure guidance. */
  subject: OllamaWebSubject
}

/**
 * Check whether an authentication source exists; does not resolve credentials.
 * @param auth - Sources for the operation.
 * @returns Whether a literal key or resolver is present.
 */
export function hasOllamaCredential(auth: OllamaWebAuth): boolean {
  return (auth.apiKey?.length ?? 0) > 0 || auth.resolveApiKey !== undefined
}

/** Narrow a remote JSON object.
 * @param value - Untrusted JSON.
 * @returns Whether readable object fields exist.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Report malformed upstream JSON without embedding response content.
 * @returns The stable provider error.
 */
export function invalidResponse(): WebError {
  return new WebError('Ollama Cloud returned an invalid response body', 'WEB_PROVIDER_ERROR')
}

/**
 * Dispatch one operation with a single settings and credential snapshot.
 * @param options - Authentication and endpoint values for this operation.
 * @param request - Resolved endpoint, JSON payload, and response decoder.
 * @param signal - Caller cancellation signal.
 * @returns The validated provider result.
 */
export async function dispatchOllamaWeb<T>(
  options: OllamaWebAuth, request: OllamaWebRequest<T>, signal?: AbortSignal,
): Promise<T> {
  const { endpoint, body, decode, subject } = request
  const apiKey = await resolveApiKey(options, signal)
  throwIfAborted(signal)
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'accept': 'application/json',
        'user-agent': USER_AGENT,
      },
      body: JSON.stringify(body),
      ...signal !== undefined ? { signal } : {},
    })
  } catch (error: unknown) {
    if (signal?.aborted === true || isAbortError(error)) throw operationAborted(signal, error)
    throw endpointError(
      subject,
      endpoint,
      `Ollama Cloud ${subject} request failed: ${String(error)}`,
      error,
    )
  }

  if (!response.ok) {
    const status = response.status
    let message = `Ollama Cloud API error (HTTP ${status})`
    try {
      const parsed = await response.json() as OllamaError
      const detail = parsed.error ?? parsed.message
      if (detail !== undefined && detail.length > 0) message += `: ${detail}`
    } catch (error: unknown) {
      // An abort fired mid-body must surface as WEB_ABORTED, not be swallowed
      // into a generic HTTP-error message — cancellation is not a provider
      // error (the seam's cancellation contract).
      if (signal?.aborted === true || isAbortError(error)) throw operationAborted(signal, error)
      // Otherwise: the HTTP status is already captured in `message` above; a
      // malformed/non-JSON error body (normal for gateway 5xx/429s) can only
      // cost a richer provider message, never the real error.
    }
    throw endpointError(subject, endpoint, message)
  }

  try {
    const payload: unknown = await response.json()
    throwIfAborted(signal)
    return decode(payload)
  } catch (error: unknown) {
    if (signal?.aborted === true || isAbortError(error)) throw operationAborted(signal, error)
    const message = error instanceof WebError
      ? error.message
      : `Ollama Cloud returned an unprocessable response body: ${String(error)}`
    throw endpointError(subject, endpoint, message, error)
  }
}

/**
 * Resolve one operation's API key without retaining it on the provider.
 * @param options - the caller's snapshot, so the key and the endpoint it is sent to come from one section.
 * @param signal - abort signal for the surrounding operation.
 * @returns the resolved key.
 */
async function resolveApiKey(options: OllamaWebAuth, signal?: AbortSignal): Promise<string> {
  throwIfAborted(signal)
  if (options.apiKey !== undefined && options.apiKey.length > 0) return options.apiKey
  const { resolveApiKey } = options
  const resolved = resolveApiKey === undefined ? undefined : await resolveCredential(resolveApiKey, signal)
  if (resolved !== undefined && resolved.length > 0) return resolved
  const ref = options.apiKeyEnv ?? OLLAMA_DEFAULT_API_KEY_ENV
  throw new WebError(
    `Ollama Cloud web access has no API key for "${ref}"; store it through the credentials service`
    + ' (the Ollama Cloud search settings page writes it), export it in the launching environment, or set a literal'
    + ' "apiKey" in the web-ollama-api config',
    'WEB_PROVIDER_CREDENTIAL_MISSING',
  )
}

/**
 * Run one credential resolver under the operation's cancellation signal. An
 * already-cancelled operation never starts the resolver.
 * @param resolve - the resolver; a synchronous throw is mapped like a rejection.
 * @param signal - abort signal for the surrounding operation.
 * @returns the resolved credential, or undefined when the resolver supplied none.
 * @throws {@link WebError} `WEB_ABORTED` on cancellation, `WEB_PROVIDER_ERROR` when the resolver fails.
 */
async function resolveCredential(
  resolve: () => Promise<string | undefined>, signal?: AbortSignal,
): Promise<string | undefined> {
  throwIfAborted(signal)
  try {
    return await abortable(resolve(), signal)
  } catch (error: unknown) {
    if (signal?.aborted === true || isAbortError(error)) throw operationAborted(signal, error)
    throw new WebError(
      `Ollama Cloud credential resolution failed: ${String(error)}`,
      'WEB_PROVIDER_ERROR',
      { cause: error },
    )
  }
}

/** Add endpoint recovery instructions to failures that occur after request dispatch begins. */
function endpointError(
  subject: OllamaWebSubject, endpoint: string, message: string, cause?: unknown,
): WebError {
  return new WebError(
    `${message}\n\nThe web ${subject} request used endpoint ${JSON.stringify(endpoint)}. `
    + `${subject === 'search' ? 'Search' : 'Fetch'} endpoint configuration is separate from chat. `
    + 'If that endpoint is not intended, '
    + 'guide the user to Settings > Plugins > Ollama Cloud search, where they can '
    + 'change and save Search API base URL. If that settings page is unavailable, the user can set '
    + 'OLLAMA_SEARCH_BASE_URL or configure web-ollama-api.baseURL to a trusted Ollama Cloud base. '
    + 'Only the user should choose or change the endpoint.',
    'WEB_PROVIDER_ERROR',
    cause === undefined ? undefined : { cause },
  )
}

/**
 * Race a same-process asynchronous preflight against caller cancellation. The
 * attached settlement handlers keep observing an uncooperative operation after
 * abort so a later rejection cannot become an unhandled.
 */
function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) return operation
  if (signal.aborted) return Promise.reject(operationAborted(signal))
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { reject(operationAborted(signal)) }
    signal.addEventListener('abort', onAbort, { once: true })
    void operation.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(new Error(String(error).replace(/^Error: /u, ''), { cause: error }))
      },
    )
  })
}

/** Throw the provider's stable cancellation error when the caller already aborted. */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw operationAborted(signal)
}

/** Build the provider's stable cancellation error while retaining the caller's reason. */
function operationAborted(signal?: AbortSignal, fallback?: unknown): WebError {
  return new WebError('Ollama Cloud web request aborted', 'WEB_ABORTED', {
    cause: signal?.aborted === true ? signal.reason : fallback,
  })
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
