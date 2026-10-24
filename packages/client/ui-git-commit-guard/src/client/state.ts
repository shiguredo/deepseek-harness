/**
 * Browser access to the Host guard-state route. The Host plugin owns
 * persistence and enforcement; this module only reads and writes the two
 * settings the UI exposes.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One answer from the Host guard-state route. */
export interface GuardState {
  /** Default applied to Sessions created from now on. */
  readonly default: boolean
  /** The addressed Session's own setting; present only for a session-addressed request. */
  readonly session?: boolean
}

/** Inject face shared by the panel and the composer chip. */
export interface GuardApi {
  /**
   * Read the default, or one Session's own setting when `sessionId` is given.
   * @param sessionId - Session whose own setting to read.
   * @returns the route's answer.
   */
  readonly loadState: (sessionId?: SessionId) => Promise<GuardState>
  /**
   * Write the default, or one Session's own setting when `sessionId` is given.
   * @param enabled - next guard setting.
   * @param sessionId - Session whose own setting to write.
   * @returns the route's answer with the stored value.
   */
  readonly saveState: (enabled: boolean, sessionId?: SessionId) => Promise<GuardState>
}

/** Same-origin route the Host package registers. */
const STATE_URL = '/commit-guard/state'

/**
 * Address the route for one setting.
 * @param sessionId - Session whose own setting is addressed.
 * @returns the route URL, carrying the Session query only for a Session setting.
 */
function stateUrl(sessionId?: SessionId): string {
  return sessionId === undefined ? STATE_URL : `${STATE_URL}?session=${encodeURIComponent(sessionId)}`
}

/**
 * @param value - parsed JSON payload.
 * @returns whether the payload is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Validate one route answer. The Host is a separate process boundary, so a
 * malformed answer is a failed request rather than a value to render.
 * @param payload - parsed JSON payload.
 * @param addressed - whether the request named a Session and must carry `session`.
 * @returns the validated guard state.
 */
function guardStateOf(payload: unknown, addressed: boolean): GuardState {
  if (!isRecord(payload)) throw new Error('commit-guard state response is not a JSON object')
  const fallback = payload.default
  if (typeof fallback !== 'boolean') throw new Error('commit-guard state response has no boolean "default"')
  if (!addressed) return { default: fallback }
  const session = payload.session
  if (typeof session !== 'boolean') throw new Error('commit-guard state response has no boolean "session"')
  return { default: fallback, session }
}

/**
 * Send one route request and validate its answer.
 * @param url - route URL.
 * @param init - request method, headers, and body.
 * @param addressed - whether the request named a Session.
 * @returns the validated guard state.
 */
async function requestState(url: string, init: RequestInit, addressed: boolean): Promise<GuardState> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`commit-guard state request failed: ${response.status}`)
  const payload: unknown = await response.json()
  return guardStateOf(payload, addressed)
}

/**
 * Read the default, or one Session's own setting.
 * @param sessionId - Session whose own setting to read; omit for the default.
 * @returns the route's answer.
 */
export function loadState(sessionId?: SessionId): Promise<GuardState> {
  return requestState(
    stateUrl(sessionId),
    { headers: { accept: 'application/json' }, cache: 'no-store' },
    sessionId !== undefined,
  )
}

/**
 * Write the default, or one Session's own setting.
 * @param enabled - next guard setting.
 * @param sessionId - Session whose own setting to write; omit for the default.
 * @returns the route's answer with the stored value.
 */
export function saveState(enabled: boolean, sessionId?: SessionId): Promise<GuardState> {
  const body = sessionId === undefined ? { enabled } : { enabled, sessionId }
  return requestState(
    STATE_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    },
    sessionId !== undefined,
  )
}
