/**
 * Composer chip for one Session's guard setting. It writes only that Session;
 * the default for new Sessions comes from the Host plugin configuration.
 */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the conversation-owned 'conversation.input.left' declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { GuardIcon } from './GuardIcon.tsx'
import { NS } from './locales.ts'
import type { GuardApi } from './state.ts'
import css from './Chip.module.css'

/** Full props for the composer guard chip. */
export type GuardChipProps =
  PropsRuntime<'conversation.input.left'>
  & PropsLocale<typeof NS>
  & InjectFace<GuardApi>

/** Size the lock glyph takes inside the chip's 26px row. */
const GLYPH_SIZE = 14

/**
 * Render this Session's own guard setting. Mount, window focus, and tab
 * visibility re-read the route so a change made in another client lands
 * without a reload; a click writes only this Session.
 * @param props - the standard Session identity, injected route callbacks, and localized copy.
 * @returns the compact guard chip.
 */
export function GuardChip({ sessionId, loadState, saveState, t }: GuardChipProps): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const refresh = (): void => {
      loadState(sessionId).then(
        (value) => {
          if (live) {
            setEnabled(value.session === true)
            setFailed(false)
          }
        },
        () => {
          if (live) setFailed(true)
        },
      )
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [loadState, sessionId])

  const ready = enabled !== undefined
  const toggle = (): void => {
    setSaving(true)
    setFailed(false)
    void saveState(enabled !== true, sessionId).then(
      (value) => { setEnabled(value.session === true) },
      () => { setFailed(true) },
    ).finally(() => { setSaving(false) })
  }
  const label = !ready ? t('statusLoading') : enabled ? t('chipOn') : t('chipOff')
  const title = failed ? t('chipFailed') : enabled ? t('chipOnTitle') : t('chipOffTitle')

  return (
    <button
      type="button"
      className={clsx(css.chip, enabled === true && css.on, failed && css.failed)}
      title={title}
      aria-pressed={enabled === true}
      disabled={!ready || saving}
      onClick={toggle}
    >
      <GuardIcon size={GLYPH_SIZE} />
      <span>{label}</span>
    </button>
  )
}
