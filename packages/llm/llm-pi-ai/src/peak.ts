/**
 * Time-windowed provider substitution for one pi-ai model entry.
 *
 * A model entry may name windows in which the request is served by another
 * provider resolved from pi-ai's installed catalog. The route keeps its own
 * provider, endpoint, and display name, so the switch is invisible to the
 * session log: only the wire endpoint follows the active window.
 *
 * A window is a local wall-clock interval, evaluated in its own IANA zone so a
 * deployment's peak hours do not follow the host process's zone. Windows
 * are matched in configuration order and the first match wins, which is what
 * lets a later window carry a narrower interval. A window may name the local
 * weekdays it applies to, which is how a deployment skips a provider's peak
 * pricing on days that provider prices as off-peak.
 *
 * @module dsh-llm-pi-ai/peak
 */

/** One provider a peak window may serve a model with. */
export interface PiAiPeakProvider {
  /** pi-ai provider id, resolved against the installed catalog. */
  provider: string
  /**
   * Model id the candidate receives. Omission keeps the routed model's own id,
   * so a window that only moves the endpoint names no model. A window may route
   * to another model of the same provider, or to a model of another one.
   */
  model?: string
  /**
   * Credential reference (environment-variable name) resolved per request
   * through the credential seam. Omission uses the candidate route's own
   * `apiKeyEnv` when the candidate is a configured route, so a window keeps
   * that route's authentication without repeating it; a candidate this build
   * knows only as an installed-catalog provider has no route profile to
   * inherit from and defers to pi-ai's provider-native ambient discovery.
   */
  apiKeyEnv?: string
}

/** The local weekdays a window may name, in `Date.prototype.getUTCDay` order. */
export const PEAK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** One local weekday a {@link PiAiPeakWindow} may name. */
export type PiAiPeakDay = typeof PEAK_DAYS[number]

/** One local wall-clock window served by an alternate provider. */
export interface PiAiPeakWindow {
  /** Inclusive local start as `HH:mm`. */
  from: string
  /** Exclusive local end as `HH:mm`; earlier than {@link from} crosses midnight. */
  to: string
  /** IANA time zone the window is evaluated in; omission uses the process zone. */
  timeZone?: string
  /**
   * Local weekdays the window applies to, named by the day the window *starts*
   * in its own zone. An absent list — which the configuration schema
   * materializes as `[]` — applies the window every day.
   *
   * A window that crosses midnight belongs to the day it starts: a
   * weekday-only `21:00`-`03:00` window serves Monday evening through
   * Saturday morning, so a Monday `01:00` request is outside it and a
   * Saturday `01:00` request is inside it. That is what keeps a weekday-only
   * window aligned with a provider whose peak hours are a weekday interval in
   * another zone.
   */
  days?: PiAiPeakDay[]
  /** Candidate providers in priority order; the first that serves the model is used. */
  providers: PiAiPeakProvider[]
}

/** The accepted `HH:mm` spelling: two-digit 24-hour hour and minute. */
export const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

/** Milliseconds in one day, for stepping between local calendar dates. */
const DAY_MS = 86_400_000

/** One instant read as local wall clock and local calendar date. */
interface LocalReading {
  /** Two-digit `HH:mm` in the window's zone. */
  clock: string
  /** Midnight UTC of the local calendar date, in epoch milliseconds. */
  date: number
}

/**
 * The local wall clock and calendar date at one instant.
 * @param now - epoch milliseconds of the request.
 * @param timeZone - IANA zone to read; omission reads the process zone.
 * @returns the two-digit time and the local date in that zone.
 */
function localReading(now: number, timeZone: string | undefined): LocalReading {
  const parts = new Intl.DateTimeFormat('en-GB', {
    ...timeZone === undefined ? {} : { timeZone },
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(now))
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find(part => part.type === type)?.value ?? ''
  // The date is rebuilt at midnight UTC so a weekday step stays exact across
  // daylight-saving transitions, where subtracting 24 hours would not.
  return {
    clock: `${read('hour')}:${read('minute')}`,
    date: Date.UTC(Number(read('year')), Number(read('month')) - 1, Number(read('day'))),
  }
}

/**
 * Whether one clock reading falls inside one window.
 * @param clock - the local `HH:mm` reading.
 * @param from - inclusive window start.
 * @param to - exclusive window end.
 * @returns whether the reading is inside the window.
 */
function inWindow(clock: string, from: string, to: string): boolean {
  return from <= to
    ? clock >= from && clock < to
    : clock >= from || clock < to
}

/**
 * Whether one reading falls on a day the window applies to.
 * @param window - the window whose `days` list is read.
 * @param reading - the local reading of the request.
 * @returns whether the window's start day is listed, or it lists no days.
 */
function onListedDay(window: PiAiPeakWindow, reading: LocalReading): boolean {
  const { days } = window
  // An absent list reaches here as `[]`; both mean no day restriction.
  if (days === undefined || days.length === 0) return true
  // An after-midnight reading belongs to the window that started the day
  // before, so a weekday-only overnight window does not serve Monday 01:00.
  const startedYesterday = window.from > window.to && reading.clock < window.to
  const day = PEAK_DAYS[new Date(reading.date - (startedYesterday ? DAY_MS : 0)).getUTCDay()]
  return day !== undefined && days.includes(day)
}

/**
 * The first configured window containing one instant.
 * @param windows - configured windows, evaluated in order.
 * @param now - epoch milliseconds of the request.
 * @returns the matching window, or `undefined` when none matches.
 */
export function selectPeakWindow(
  windows: readonly PiAiPeakWindow[],
  now: number,
): PiAiPeakWindow | undefined {
  return windows.find((window) => {
    const reading = localReading(now, window.timeZone)
    return inWindow(reading.clock, window.from, window.to) && onListedDay(window, reading)
  })
}
