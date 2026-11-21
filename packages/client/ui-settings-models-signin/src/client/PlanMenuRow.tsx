/**
 * The model menu's plan row: which plan pays for the selected model, and where
 * its usage is managed.
 *
 * OpenAI's guidelines put this beside the model selector rather than in the
 * composer, and their own illustration shows it as the last row of the open
 * menu. That placement is what keeps it honest and quiet: it appears when
 * someone is already looking at what serves the Session, and costs nothing
 * while the menu is closed.
 */

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the model menu's slot map this row registers into.
import type {} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { ModelSignInFace } from './face.ts'
import { useFlows } from './useFlows.ts'
import css from './SignInSection.module.css'

/** Where a ChatGPT-plan sign-in reports and manages its usage. */
const USAGE_URL = 'https://chatgpt.com/settings/usage'

/** Props the model menu binds for one option row. */
export type PlanMenuRowProps =
  PropsRuntime<'conversation.input.model.options'>
  & PropsLocale<'settings.modelsSignIn'>
  & InjectFace<ModelSignInFace>

/**
 * Render the plan row for the Session's selected model, or nothing.
 * @param props - the menu's controls, the Session's projections, and the Remote.
 * @returns the row, or null when an API key pays for the selection.
 */
export function PlanMenuRow(props: PlanMenuRowProps): ReactNode {
  const { t, dismiss, current } = props
  const flows = useFlows(props.list)
  // The seat owns what the menu is showing; a Session's projection only names
  // the same provider once one exists, which a blank Session has not reached.
  const provider = current?.provider
  const flow = flows?.find(candidate => candidate.provider === provider)
  if (flow === undefined || flow.credential !== 'grant') return null

  return (
    <a
      className={css.menuRow}
      role="menuitem"
      href={USAGE_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => { dismiss() }}
    >
      <span className={css.menuRowLabel}>{t('planInUse')}</span>
      <span className={css.menuRowAction}>{t('manageUsage')}</span>
    </a>
  )
}
