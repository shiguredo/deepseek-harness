/** General Settings row for the zone message clocks read. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CLOCK_TIME_ZONES, type ClockTimeZone } from '../../chat-settings.ts'
import type { ChatKey } from '../locale.ts'
import { PreferenceRow } from './PreferenceRow.tsx'

/** Registration-side clock-zone preference face. */
export interface ClockTimeZoneRowInjected {
  hooks: {
    /** Live zone, bound as useClockTimeZone. */
    clockTimeZone: SnapshotStore<ClockTimeZone>
  }
  /** Change the zone message clocks read. */
  setClockTimeZone: (zone: ClockTimeZone) => void
}

/** Full Settings-row props. */
export type ClockTimeZoneRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'chat'>
  & InjectFace<ClockTimeZoneRowInjected>

const LABELS = {
  local: 'settings.clockTimeZone.local',
  jst: 'settings.clockTimeZone.jst',
  utc: 'settings.clockTimeZone.utc',
} as const satisfies Record<ClockTimeZone, ChatKey>

/**
 * Render the message-clock zone selector.
 * @param props - composed Settings slot props.
 * @returns The preference row.
 */
export function ClockTimeZoneRow({ useClockTimeZone, setClockTimeZone, t }: ClockTimeZoneRowProps) {
  const zone = useClockTimeZone(value => value)
  return (
    <PreferenceRow
      title={t('settings.clockTimeZone.title')}
      description={t('settings.clockTimeZone.description')}
      value={zone}
      selectedLabel={t(LABELS[zone])}
      options={CLOCK_TIME_ZONES.map(id => ({ id, label: t(LABELS[id]) }))}
      onSelect={(value) => { setClockTimeZone(value as ClockTimeZone) }}
    />
  )
}
