/**
 * Font-family preference row registered into the General section item slot:
 * title + description + a single-line input holding a CSS font-family list.
 * Empty values return to the plugin's built-in default stacks. The input
 * commits on Enter or blur; text the normalization rejects stays in the field
 * for correction instead of replacing the saved font.
 */
import { useState } from 'react'
import clsx from 'clsx'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { FONT_FAMILY_MAX_LENGTH } from '../font-settings.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createFontFamilyRowStore } from './settings-store.ts'
import { NS } from './locales.ts'
import css from './FontFamilyRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface FontFamilyRowInjected {
  /** Set or clear the font-family override (empty returns to the built-in stacks). */
  setFontFamily: (value: string) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type FontFamilyRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createFontFamilyRowStore>>
  & PropsLocale<typeof NS> & FontFamilyRowInjected

/**
 * Render the font-family row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function FontFamilyRow({ t, setFontFamily, useStore }: FontFamilyRowComponentProps) {
  const fontFamily = useStore(s => s.fontFamily)
  const [invalid, setInvalid] = useState(false)
  const commit = (value: string): boolean => {
    try {
      setFontFamily(value)
      setInvalid(false)
      return true
    } catch {
      // The service rejects text that cannot be one CSS font-family list; leave
      // it in the field so the user can correct it rather than replacing the
      // saved font with a value the browser would ignore.
      setInvalid(true)
      return false
    }
  }
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('fontFamily.title')}</div>
        <div className={css.desc}>{t('fontFamily.description')}</div>
      </div>
      <Input
        key={fontFamily}
        className={clsx(css.input)}
        defaultValue={fontFamily}
        maxLength={FONT_FAMILY_MAX_LENGTH}
        placeholder={t('fontFamily.placeholder')}
        aria-label={t('fontFamily.title')}
        {...invalid ? { 'aria-invalid': true } : {}}
        onBlur={(event) => { commit(event.currentTarget.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && commit(event.currentTarget.value)) event.currentTarget.blur()
        }}
      />
    </div>
  )
}
