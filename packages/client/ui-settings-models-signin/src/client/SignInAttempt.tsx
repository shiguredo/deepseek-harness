/**
 * The running half of one provider sign-in: what the flow said, the browser
 * step, the question it asks — a method choice or a pasted redirect URL — and
 * the cancellation.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelsSignInLocaleKey } from './locales.ts'
import type { ModelSignInFace } from './face.ts'
import type { SignInAttemptView } from '../types.ts'
import css from './SignInSection.module.css'

/** Polling cadence of one running attempt; the flow reports only a few phases. */
const POLL_MS = 700

/** Props of one attempt panel. */
export interface SignInAttemptProps {
  /** Attempt the Host is running. */
  readonly attemptId: string
  /** Remote callback reading the attempt's view. */
  readonly poll: ModelSignInFace['poll']
  /** Remote callback answering the pending question. */
  readonly answer: ModelSignInFace['answer']
  /** Remote callback withdrawing the attempt. */
  readonly cancel: ModelSignInFace['cancel']
  /** Localized copy. */
  readonly t: (key: ModelsSignInLocaleKey) => string
  /** Called once the attempt settles, with whether it succeeded. */
  readonly onSettled: (succeeded: boolean) => void
  /** Called when the human dismisses the panel. */
  readonly onClose: () => void
}

/** Where the attempt stands, as the panel renders it. */
function phaseText(view: SignInAttemptView | null, t: SignInAttemptProps['t']): string {
  if (view === null) return t('waiting')
  switch (view.phase) {
    case 'succeeded': return t('succeeded')
    case 'failed': return view.error ?? t('failed')
    case 'cancelled': return t('cancel')
    default: return t('waiting')
  }
}

/**
 * Render one attempt: the browser step, the flow's question, and — for a
 * question asking for text — the paste field a remote browser needs.
 * @param props - the attempt identity, Remote callbacks, and localized copy.
 * @returns the attempt panel.
 */
export function SignInAttempt(props: SignInAttemptProps): ReactNode {
  const { attemptId, poll, answer, cancel, t, onSettled, onClose } = props
  const [view, setView] = useState<SignInAttemptView | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  // Polling is this panel's only subscription: the Host keeps the attempt, and
  // the panel disappears with it, so there is no snapshot to keep beyond it.
  useEffect(() => {
    let live = true
    let settled = false
    const timer = setInterval(() => { void tick() }, POLL_MS)
    const settle = (next: SignInAttemptView): void => {
      if (settled || !live) return
      settled = true
      clearInterval(timer)
      onSettled(next.phase === 'succeeded')
    }
    async function tick(): Promise<void> {
      try {
        const next = await poll(attemptId)
        if (!live) return
        if (next === undefined) {
          clearInterval(timer)
          onSettled(false)
          return
        }
        setView(next)
        if (next.phase !== 'starting' && next.phase !== 'waiting') settle(next)
      } catch {
        if (!live) return
        clearInterval(timer)
        onSettled(false)
      }
    }
    void tick()
    return () => { live = false; clearInterval(timer) }
  }, [attemptId, poll, onSettled])

  const prompt = view?.prompt ?? null
  const lastUrl = view?.notices.slice().reverse().find(notice => notice.url !== undefined)?.url
  const code = view?.notices.slice().reverse().find(notice => notice.code !== undefined)?.code
  const message = view?.notices.at(-1)?.message
  const running = view === null || view.phase === 'starting' || view.phase === 'waiting'

  /** Deliver one answer to the question the flow waits on. */
  async function submit(value: string): Promise<void> {
    if (prompt === null || value.trim() === '') return
    setBusy(true)
    try {
      setView(await answer(attemptId, prompt.id, value.trim()))
      setTyped('')
    } catch {
      // A superseded question is the one failure the flow explains itself; the
      // next poll carries the flow's own state either way.
    } finally {
      setBusy(false)
    }
  }

  /** Withdraw the attempt and close the panel. */
  async function withdraw(): Promise<void> {
    setBusy(true)
    try {
      await cancel(attemptId)
    } finally {
      setBusy(false)
      onClose()
    }
  }

  return (
    <div className={css.attempt} role="group" aria-label={t('attemptTitle')}>
      <p className={css.attemptStatus} role="status">{phaseText(view, t)}</p>
      {message === undefined ? null : <p className={css.attemptNotice}>{message}</p>}
      {code === undefined ? null : <p className={css.attemptCode}>{t('code')}: <code>{code}</code></p>}
      {running
        ? (
          <>
            <p className={css.attemptHint}>{t('browserHint')}</p>
            {lastUrl === undefined
              ? null
              : <a className={css.link} href={lastUrl} target="_blank" rel="noreferrer">{t('openPage')}</a>}
            {prompt?.kind === 'select'
              ? (
                <div className={css.choices} role="group" aria-label={prompt.message}>
                  <p className={css.attemptPrompt}>{prompt.message}</p>
                  {prompt.options?.map(option => (
                    <Button key={option.id} onClick={() => { void submit(option.id) }} disabled={busy}>
                      {option.label}
                    </Button>
                  ))}
                </div>
              )
              : (
                <>
                  {prompt === null ? null : <p className={css.attemptPrompt}>{prompt.message}</p>}
                  <label className={css.pasteField}>
                    <span className={css.pasteLabel}>{t('pasteLabel')}</span>
                    <input
                      className={css.pasteInput}
                      value={typed}
                      onChange={(event) => { setTyped(event.target.value) }}
                      onKeyDown={(event) => { if (event.key === 'Enter') void submit(typed) }}
                      placeholder={prompt?.placeholder ?? ''}
                      disabled={busy || prompt === null}
                      aria-label={t('pasteLabel')}
                    />
                  </label>
                  <p className={css.attemptHint}>{t('pasteHint')}</p>
                </>
              )}
            <div className={css.actions}>
              {prompt?.kind === 'select'
                ? null
                : (
                  <Button onClick={() => { void submit(typed) }} disabled={busy || prompt === null || typed.trim() === ''}>
                    {t('continue')}
                  </Button>
                )}
              <Button onClick={() => { void withdraw() }} disabled={busy}>{t('cancel')}</Button>
            </div>
          </>
        )
        : (
          <div className={css.actions}>
            <Button onClick={onClose}>{t('dismiss')}</Button>
          </div>
        )}
    </div>
  )
}
