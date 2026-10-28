// One quiet timestamp line above the message it belongs to. Keeping it out of
// MessageIconActions lets the icons reveal on hover without moving the clock.

import type { ReactNode } from 'react'
import type { ClockTimeZone } from '../../chat-settings.ts'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { formatMessageClock } from './message-chrome.ts'
import css from './MessageClock.module.css'

export interface MessageClockProps {
  /** Unix epoch ms from the source session event. */
  time: number
  /** Zone the clock reads; `local` follows the device. */
  zone: ClockTimeZone
  /** Parent-composed placement class; the row module owns its margins. */
  className?: string | undefined
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/**
 * Render the message timestamp in the selected zone. The text depends only on
 * the event time, so it needs no clock subscription or midnight re-render.
 * @param props - Event time, zone preference, placement class, and locale seat.
 * @returns The timestamp line.
 */
export function MessageClock({ time, zone, className, t }: MessageClockProps): ReactNode {
  const classes = className === undefined ? css.clock : `${css.clock} ${className}`
  return (
    <span className={classes} data-message-clock>
      {formatMessageClock(time, t, zone)}
    </span>
  )
}
