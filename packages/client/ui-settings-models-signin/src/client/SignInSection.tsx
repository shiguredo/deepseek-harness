/**
 * One provider card's sign-in section: who the provider is signed in as, the
 * action that starts a sign-in, and the panel that drives one attempt.
 *
 * A card renders nothing here until the Host reports a flow for its route, so
 * a composition that never opted into an account sign-in shows no trace of it.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the Models page's SlotMap merge and the provider-card owner props.
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { SignInAttempt } from './SignInAttempt.tsx'
import type { ModelSignInFace } from './face.ts'
import type { SignInFlowView } from '../types.ts'
import css from './SignInSection.module.css'

/** Where a ChatGPT-plan sign-in reports its usage, as OpenAI's guidelines direct. */
const USAGE_URL = 'https://chatgpt.com/settings/usage'

/**
 * Browser-local record of the accounts this browser has already welcomed.
 *
 * OpenAI's guidelines ask for the plan confirmation on a person's first sign-in
 * and not on later ones, which is a fact about this browser rather than about
 * the Host's stored credential.
 */
const WELCOMED_KEY = 'dsh.chatgpt-plan.welcomed'

/** Whether this browser has already confirmed the plan for one account. */
function welcomedBefore(key: string): boolean {
  try {
    return window.localStorage.getItem(`${WELCOMED_KEY}:${key}`) === '1'
  } catch {
    // A browser that refuses site storage is not a reason to withhold the
    // confirmation; it shows once more and still works.
    return false
  }
}

/** Remember that this browser has confirmed the plan for one account. */
function recordWelcomed(key: string): void {
  try {
    window.localStorage.setItem(`${WELCOMED_KEY}:${key}`, '1')
  } catch {
    // Same as reading: the message is worth more than the memory of it.
  }
}


/** Props the Models page binds for one provider card's extension area. */
export type SignInSectionProps =
  PropsRuntime<'settings.models.provider-card'>
  & PropsLocale<'settings.modelsSignIn'>
  & InjectFace<ModelSignInFace>

/**
 * Render the provider's sign-in section, or nothing when no flow serves it.
 * @param props - the card's directory row, localized copy, and Remote callbacks.
 * @returns the section, or null.
 */
export function SignInSection(props: SignInSectionProps): ReactNode {
  const { provider, configured, editing, t } = props
  const [flows, setFlows] = useState<readonly SignInFlowView[] | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<'read' | 'start' | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const flow = flows?.find(candidate => candidate.provider === provider.provider)
  // Only an account sign-in belongs here: an API-key method is the card's
  // own key field, and repeating it as a button would offer the same write twice.
  const oauth = flow?.methods.find(method => method.id === 'oauth')

  // The Remote callbacks are stable face members, so depending on the one
  // this effect calls keeps a re-render from re-reading the flows forever.
  const list = props.list
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setFlows(await list())
    } catch {
      setFailed('read')
    }
  }, [list])

  useEffect(() => { void refresh() }, [refresh, provider.provider])

  /** Start the flow's preferred method. */
  async function start(): Promise<void> {
    if (flow === undefined || oauth === undefined) return
    setBusy(true)
    setFailed(null)
    try {
      const attempt = await props.begin(flow.key, oauth.id)
      setAttemptId(attempt.id)
    } catch {
      setFailed('start')
    } finally {
      setBusy(false)
    }
  }

  /** Close the attempt panel without changing the stored record. */
  const closeAttempt = useCallback((): void => { setAttemptId(null) }, [])

  /** Finish one attempt: close it, welcome a first sign-in, and re-read the flows. */
  const settleAttempt = useCallback((succeeded: boolean): void => {
    setAttemptId(null)
    if (succeeded && flow !== undefined) {
      const welcomed = welcomedBefore(flow.key)
      if (!welcomed) recordWelcomed(flow.key)
      setConfirmed(!welcomed)
    }
    void refresh()
  }, [refresh, flow])

  /** Forget the stored credential record. */
  async function signOut(): Promise<void> {
    if (flow === undefined) return
    setBusy(true)
    try {
      await props.signOut(flow.key)
      setConfirmed(false)
      await refresh()
    } catch {
      setFailed('start')
    } finally {
      setBusy(false)
    }
  }

  // A collapsed row summarizes and cannot change account state; its one
  // account statement is the identity mark beside the name, which the page
  // renders through its own seat.
  if (!editing) return null
  if (flow === undefined || oauth === undefined) return null

  return (
    <div className={css.section}>
      <div className={css.head}>
        <span className={css.title}>{t('sectionTitle')}</span>
        <span className={css.status}>{flow.signedIn ? t('signedInHint') : t('signedOutHint')}</span>
      </div>
      {confirmed
        ? (
          <div className={css.confirmed} role="status">
            <span>{t('planConfirmed')}</span>
            <a className={css.link} href={USAGE_URL} target="_blank" rel="noreferrer">{t('manageUsage')}</a>
            <Button onClick={() => { setConfirmed(false) }}>{t('dismiss')}</Button>
          </div>
        )
        : null}
      {flow.signedIn || attemptId !== null ? null : <p className={css.hint}>{t('startHint')}</p>}
      {flow.signedIn && !configured ? <p className={css.hint}>{t('saveHint')}</p> : null}
      <div className={css.actions}>
        {flow.signedIn
          ? (
            <>
              <Button onClick={() => { void signOut() }} disabled={busy}>{t('signOut')}</Button>
              <a className={css.link} href={USAGE_URL} target="_blank" rel="noreferrer">{t('manageUsage')}</a>
            </>
          )
          : <Button onClick={() => { void start() }} disabled={busy}>{oauth.label}</Button>}
      </div>
      <p className={css.terms}>
        <span>{t('planTerms')}</span>
        <a className={css.link} href={t('termsUrl')} target="_blank" rel="noreferrer">{t('learnMore')}</a>
      </p>
      {failed === null ? null : <p className={css.error} role="alert">{t(failed === 'read' ? 'loadFailed' : 'startFailed')}</p>}
      {attemptId === null
        ? null
        : (
          <SignInAttempt
            attemptId={attemptId}
            key={flow.key}
            poll={props.poll}
            answer={props.answer}
            cancel={props.cancel}
            t={t}
            onClose={closeAttempt}
            onSettled={settleAttempt}
          />
        )}
    </div>
  )
}
