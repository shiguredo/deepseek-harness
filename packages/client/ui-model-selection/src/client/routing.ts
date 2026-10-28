/**
 * Local-time evaluation of the routing windows a catalog model advertises.
 *
 * The Host decides which provider serves a request; this module only answers
 * whether the selector should mark the model as currently routed, so the
 * reading is the browser's own clock and zone resolution.
 *
 * @module @deepseek-ai/dsh-client-ui-model-selection/routing
 */

import type { ModelProviderGroup } from '@deepseek-ai/dsh-api-remotes/client'

/** The routing declaration one catalog model may carry. */
export type ModelRouting = NonNullable<ModelProviderGroup['models'][number]['routing']>

/** One window of a {@link ModelRouting} declaration. */
export type ModelRoutingWindow = ModelRouting['windows'][number]

/** Milliseconds in one day, for stepping between local calendar dates. */
const DAY_MS = 86_400_000

/** Weekday names in the order the adapter's `days` list uses. */
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** One instant read as local wall clock and local calendar date. */
interface LocalReading {
  /** Two-digit `HH:mm` in the window's zone. */
  clock: string
  /** Midnight UTC of the local calendar date, in epoch milliseconds. */
  date: number
}

/**
 * The local wall clock and calendar date at one instant.
 * @param now - epoch milliseconds to read.
 * @param timeZone - IANA zone to read; omission reads the browser's zone.
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
function onListedDay(window: ModelRoutingWindow, reading: LocalReading): boolean {
  const { days } = window
  // An absent list reaches here as `[]`; both mean no day restriction.
  if (days === undefined || days.length === 0) return true
  // An after-midnight reading belongs to the window that started the day
  // before, so a weekday-only overnight window does not mark Monday 01:00.
  const startedYesterday = window.from > window.to && reading.clock < window.to
  const day = WEEKDAYS[new Date(reading.date - (startedYesterday ? DAY_MS : 0)).getUTCDay()]
  return day !== undefined && days.includes(day)
}

/**
 * The first declared window containing one instant.
 * @param routing - the declared windows.
 * @param now - epoch milliseconds to evaluate.
 * @returns the active window, or `undefined` when none contains the reading.
 */
export function activeRoutingWindow(routing: ModelRouting, now: number): ModelRoutingWindow | undefined {
  return routing.windows.find((entry) => {
    const reading = localReading(now, entry.timeZone)
    return inWindow(reading.clock, entry.from, entry.to) && onListedDay(entry, reading)
  })
}
