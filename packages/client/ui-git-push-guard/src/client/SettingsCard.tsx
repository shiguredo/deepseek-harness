/**
 * Built-in plugins settings card: the guard default for new Sessions. It reads
 * and writes the default over the Host package's same-origin state route, so
 * the setting is visible beside the other built-in plugin settings instead of
 * a sidebar page.
 */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the Plugins page's owner props (the `plugins.shiguredo` entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { NS } from './locales.ts'
import type { GuardApi } from './state.ts'
import css from './SettingsCard.module.css'

/** Full props for the built-in settings card. */
export type GuardSettingsCardProps =
  PropsRuntime<'plugins.shiguredo'>
  & PropsLocale<typeof NS>
  & InjectFace<GuardApi>

/**
 * Render the guard's built-in settings entry: a one-line summary in the card
 * head, or the default-setting form on the page.
 * @param props - the view the Plugins page asks for, localized copy, and the injected route callbacks.
 * @returns the summary line, or the default-setting form.
 */
export function GuardSettingsCard({ view, loadState, saveState, t }: GuardSettingsCardProps): React.JSX.Element | string {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (view !== 'page') return
    let live = true
    loadState().then(
      (value) => {
        if (live) {
          setEnabled(value.default)
          setFailed(false)
        }
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => { live = false }
  }, [loadState, view])

  if (view === 'summary') return t('settingsSummary')

  const ready = enabled !== undefined
  const choose = (next: boolean): void => {
    setSaving(true)
    setFailed(false)
    void saveState(next).then(
      (value) => { setEnabled(value.default) },
      () => { setFailed(true) },
    ).finally(() => { setSaving(false) })
  }

  return (
    <div className={css.form}>
      <p className={css.status}>
        {!ready ? t('statusLoading') : enabled ? t('settingsOn') : t('settingsOff')}
      </p>
      <div className={css.segments} role="group" aria-label={t('settingsDefaultLabel')}>
        <button
          type="button"
          className={clsx(css.segment, enabled === true && css.active)}
          aria-pressed={enabled === true}
          disabled={!ready || saving}
          onClick={() => { choose(true) }}
        >
          {t('settingsOn')}
        </button>
        <button
          type="button"
          className={clsx(css.segment, enabled === false && css.active)}
          aria-pressed={enabled === false}
          disabled={!ready || saving}
          onClick={() => { choose(false) }}
        >
          {t('settingsOff')}
        </button>
      </div>
      {failed ? <p className={css.error} role="alert">{t('settingsFailed')}</p> : null}
      <p className={css.hint}>{t('settingsHint')}</p>
    </div>
  )
}
