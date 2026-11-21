/**
 * The composer's plan-limit notice: what stopped the request, and where the
 * plan that paid for it is managed.
 *
 * A Session runs on one selected model, and that model's route is served by the
 * credential its card holds: a sign-in grant when the provider's account pays,
 * an API key when a key does. This notice speaks only for the first case, and
 * only once the plan's own usage limit has stopped a request — the one moment a
 * person needs the settings page it points at.
 */

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the Conversation slot map this component registers into.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ModelSignInFace } from './face.ts'
import { useFlows } from './useFlows.ts'
import { PLAN_USAGE_LIMIT_CODE } from '../types.ts'
import css from './SignInSection.module.css'

/** Where a ChatGPT-plan sign-in reports and manages its usage. */
const USAGE_URL = 'https://chatgpt.com/settings/usage'

/** Props the Conversation binds for one composer dock entry. */
export type PlanUsageProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<'settings.modelsSignIn'>
  & InjectFace<ModelSignInFace>

/**
 * Render the plan line for the Session's selected model, or nothing.
 * @param props - the Session snapshot, its projections, and the sign-in Remote.
 * @returns the usage line, or null when the selection is not plan-paid.
 */
export function PlanUsage(props: PlanUsageProps): ReactNode {
  const { t } = props
  const flows = useFlows(props.list)
  // The projection names the model the Session will run next, or the last one
  // it ran; either way its provider is the route whose credential pays.
  const selection = props.useProjection('modelSelection')
  const provider = selection?.next?.provider ?? selection?.lastUsed?.provider

  const flow = flows?.find(candidate => candidate.provider === provider)
  if (flow === undefined || flow.credential !== 'grant') return null

  // The failure text is all a Client receives; the adapter's own classifier
  // reads provider text the same way, and the code is the stable part of it.
  // Nothing is said while the plan simply pays: the composer is where a person
  // writes, and a line repeating which plan funds the model is noise there. The
  // state worth interrupting for is the one that stops work.
  const limitReached = (props.session.lastAgentError ?? '').includes(PLAN_USAGE_LIMIT_CODE)
  if (!limitReached) return null
  return (
    <div className={css.planLimit} role="status">
      <span className={css.planLimitTitle}>{t('planLimitTitle')}</span>
      <span className={css.planLimitBody}>{t('planLimitBody')}</span>
      <a className={css.planLimitAction} href={USAGE_URL} target="_blank" rel="noreferrer">{t('manageUsage')}</a>
    </div>
  )
}
