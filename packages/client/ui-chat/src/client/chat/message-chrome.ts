// Shared time-label helpers for user/assistant message chrome.

import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClockTimeZone } from '../../chat-settings.ts'

/** The clock and zone-label share of the conversation dictionary the clock consumes. */
export type ClockTranslate = Translate<'clock.zoned' | 'clock.zone.jst' | 'clock.zone.utc'>

/** Elapsed-duration share of the conversation dictionary. */
export type RunDurationTranslate =
  Translate<'duration.secondUnit' | 'duration.minuteUnit' | 'duration.hourUnit'>

/** Refresh interval for whole-second live run clocks. */
export const LIVE_RUN_CLOCK_INTERVAL_MS = 1000

/** Japan Standard Time offset from UTC; the zone has no daylight saving. */
const JST_OFFSET_MS = 9 * 3_600_000

/** Dictionary key naming a pinned zone; the device zone appends no label. */
const ZONE_LABEL_KEY = {
  local: undefined,
  jst: 'clock.zone.jst',
  utc: 'clock.zone.utc',
} as const satisfies Record<ClockTimeZone, string | undefined>

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Calendar and clock fields of one instant as the selected zone reads them. */
interface ClockFields {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
}

/**
 * Read one instant in the selected zone. `jst` and `utc` are fixed offsets, so
 * the UTC getters of a shifted instant name their wall clock exactly; `local`
 * reads the runtime's own calendar because its offset moves with DST.
 * @param ms - Unix epoch ms.
 * @param zone - Zone the clock reads.
 * @returns That zone's calendar and clock fields.
 */
function fieldsIn(ms: number, zone: ClockTimeZone): ClockFields {
  if (zone === 'local') {
    const d = new Date(ms)
    return {
      year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
      hour: d.getHours(), minute: d.getMinutes(), second: d.getSeconds(),
    }
  }
  const d = new Date(ms + (zone === 'jst' ? JST_OFFSET_MS : 0))
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds(),
  }
}

/** One numeric value or localized unit in an elapsed-time label. */
export interface RunDurationPart {
  readonly text: string
  readonly numeric: boolean
}

/**
 * Build elapsed-time fragments for both live and completed Turn labels.
 * @param ms - elapsed milliseconds; negatives clamp to zero and fractions floor.
 * @param t - translate seat supplying units and their trailing spacing.
 * @returns numbers and localized units in display order, without leading zeros;
 * minutes start at 60 seconds and hours at 60 minutes.
 */
export function formatRunDuration(ms: number, t: RunDurationTranslate): RunDurationPart[] {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const seconds = total % 60
  const parts: RunDurationPart[] = []
  if (hours > 0) parts.push({ text: String(hours), numeric: true }, { text: t('duration.hourUnit'), numeric: false })
  if (total >= 60) parts.push({ text: String(minutes), numeric: true }, { text: t('duration.minuteUnit'), numeric: false })
  parts.push({ text: String(seconds), numeric: true }, { text: t('duration.secondUnit'), numeric: false })
  return parts
}

/**
 * Decode-throughput figure: whole tokens from ten up, one decimal below.
 * @param tps - Tokens per second.
 * @returns Display number without unit.
 */
export function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}

/**
 * Message timestamp in the selected zone as `YYYY-MM-DDTHH:mm:ss`, with the
 * zone named in parentheses when it is pinned rather than the device's. Every
 * field comes from `time` alone, so the text needs no reference instant and no
 * re-render when a date boundary passes.
 * @param time - Unix epoch ms from the source session event.
 * @param t - translate seat supplying the zoned template and zone labels.
 * @param zone - Zone the clock reads; `local` follows the device.
 * @returns Zoned clock string (24-hour, zero-padded fields).
 */
export function formatMessageClock(
  time: number,
  t: ClockTranslate,
  zone: ClockTimeZone = 'local',
): string {
  const at = fieldsIn(time, zone)
  const clock = `${at.year}-${pad2(at.month)}-${pad2(at.day)}`
    + `T${pad2(at.hour)}:${pad2(at.minute)}:${pad2(at.second)}`
  const labelKey = ZONE_LABEL_KEY[zone]
  return labelKey === undefined ? clock : t('clock.zoned', { time: clock, zone: t(labelKey) })
}
