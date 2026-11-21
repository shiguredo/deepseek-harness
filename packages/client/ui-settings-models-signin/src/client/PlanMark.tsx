/**
 * The Models row's account mark: a provider whose route an account sign-in
 * supplies.
 *
 * The page's own credential dot speaks for an api-key reference, which a
 * plan-paid route does not have, so without this mark a ready route reads like
 * an unconfigured one. It sits on the row's name line beside that dot rather
 * than in the card's editor area, because it states what the row is, not what
 * someone may change here.
 */

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the Models page's slot map this mark registers into.
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { ModelSignInFace } from './face.ts'
import { useFlows } from './useFlows.ts'
import css from './SignInSection.module.css'

/** Props the Models page binds for one row's mark. */
export type PlanMarkProps =
  PropsRuntime<'settings.models.provider-mark'>
  & PropsLocale<'settings.modelsSignIn'>
  & InjectFace<ModelSignInFace>

/**
 * Render the mark for a row an account sign-in supplies, or nothing.
 * @param props - the row's directory entry, localized copy, and the Remote.
 * @returns the mark, or null when an api-key reference or nothing supplies it.
 */
export function PlanMark(props: PlanMarkProps): ReactNode {
  const { provider, t } = props
  const flows = useFlows(props.list)
  const flow = flows?.find(candidate => candidate.provider === provider.provider)
  if (flow === undefined || flow.credential !== 'grant') return null

  return (
    <span className={css.rowMark} role="img" aria-label={t('accountMark')} title={t('accountMark')}>
      <span className={css.rowMarkDot} aria-hidden="true" />
      {t('accountMark')}
    </span>
  )
}
