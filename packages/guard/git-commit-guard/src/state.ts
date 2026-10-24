/**
 * Durable guard state: the default for new sessions plus one choice per
 * session.
 *
 * The file is small JSON read at activation and rewritten on every change. A
 * session without a stored choice captures the current default on first use, so
 * changing the default afterwards never reaches a session that already has its
 * own value.
 *
 * @module @deepseek-ai/dsh-git-commit-guard/state
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Persisted guard state. */
export interface GuardState {
  /** Whether new sessions start with the guard enabled. */
  readonly default: boolean
  /** One explicit choice per session id; absent means "capture the current default". */
  readonly sessions: Record<string, boolean>
}

/** Mutable view the plugin updates in place. */
export interface MutableGuardState {
  default: boolean
  sessions: Record<string, boolean>
}

/**
 * Read the persisted state, falling back to the configured default.
 * @param file - absolute state file path.
 * @param defaultEnabled - value used when the file is absent or unreadable.
 * @returns the loaded state.
 */
export function loadGuardState(file: string, defaultEnabled: boolean): MutableGuardState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    const record = asRecord(parsed)
    if (record === undefined) return { default: defaultEnabled, sessions: {} }
    const sessions: Record<string, boolean> = {}
    const storedSessions = asRecord(record['sessions'])
    if (storedSessions !== undefined) {
      for (const [id, enabled] of Object.entries(storedSessions)) {
        if (typeof enabled === 'boolean') sessions[id] = enabled
      }
    }
    const fallback = record['default']
    return { default: typeof fallback === 'boolean' ? fallback : defaultEnabled, sessions }
  } catch {
    return { default: defaultEnabled, sessions: {} }
  }
}

/**
 * Read one unknown value as a plain JSON object.
 * @param value - parsed JSON value.
 * @returns the record, or undefined for every non-object value.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/**
 * Persist one state snapshot, creating its directory.
 * @param file - absolute state file path.
 * @param state - the state to write.
 */
export function saveGuardState(file: string, state: MutableGuardState): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(state)}\n`)
}

/**
 * Report whether the guard applies to one session, capturing the current
 * default the first time the session is seen.
 * @param state - live state; a captured choice is written into it.
 * @param sessionId - session whose own setting decides.
 * @param persist - writes the state after a capture.
 * @returns the session's effective setting.
 */
export function sessionEnabled(state: MutableGuardState, sessionId: string, persist: () => void): boolean {
  const stored = state.sessions[sessionId]
  if (stored !== undefined) return stored
  state.sessions[sessionId] = state.default
  persist()
  return state.default
}
