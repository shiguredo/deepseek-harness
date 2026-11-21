// @vitest-environment jsdom
/** The attempt panel: it renders the flow's question and answers it in the flow's vocabulary. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SignInAttempt } from '../src/client/SignInAttempt.tsx'
import type { ModelsSignInLocaleKey } from '../src/client/locales.ts'
import type { SignInAttemptView } from '../src/types.ts'

afterEach(cleanup)

const t = (key: ModelsSignInLocaleKey): string => key

/** One view the Host would report for a running attempt. */
function viewOf(patch: Partial<SignInAttemptView>): SignInAttemptView {
  return {
    id: 'attempt-1', key: 'llm-pi-ai/openai-codex', method: 'oauth', phase: 'waiting',
    notices: [{ seq: 1, message: 'A browser window should open.', url: 'https://auth.example/start' }],
    prompt: null,
    ...patch,
  }
}

/** Render one attempt around a fixed view. */
function bench(view: SignInAttemptView) {
  const answer = vi.fn(async () => view)
  const cancel = vi.fn(async () => view)
  const onSettled = vi.fn()
  render(
    <SignInAttempt
      attemptId={view.id}
      poll={async () => view}
      answer={answer}
      cancel={cancel}
      t={t}
      onSettled={onSettled}
      onClose={() => {}}
    />,
  )
  return { answer, cancel, onSettled }
}

describe('SignInAttempt', () => {
  it('offers every choice of a method question and answers with its id', async () => {
    const view = viewOf({
      prompt: {
        id: 7, kind: 'select', message: 'Select OpenAI Codex login method:',
        options: [{ id: 'browser', label: 'Browser login (default)' }, { id: 'device_code', label: 'Device code login (headless)' }],
      },
    })
    const { answer } = bench(view)

    expect(await screen.findByText('Select OpenAI Codex login method:')).toBeTruthy()
    const device = await screen.findByRole('button', { name: 'Device code login (headless)' })
    device.click()

    expect(answer).toHaveBeenCalledWith('attempt-1', 7, 'device_code')
  })

  it('asks for the pasted redirect URL when the flow waits on text', async () => {
    const view = viewOf({ prompt: { id: 3, kind: 'text', message: 'Paste the redirect URL' } })
    const { answer } = bench(view)

    const field = await screen.findByLabelText('pasteLabel')
    fireEvent.change(field, { target: { value: 'http://127.0.0.1:1455/auth/callback?code=abc' } })
    fireEvent.click(await screen.findByRole('button', { name: 'continue' }))

    await waitFor(() => {
      expect(answer).toHaveBeenCalledWith('attempt-1', 3, 'http://127.0.0.1:1455/auth/callback?code=abc')
    })
  })

  it('shows the flow notice and the page a browser step needs', async () => {
    bench(viewOf({}))

    expect(await screen.findByText('A browser window should open.')).toBeTruthy()
    expect((await screen.findByRole('link', { name: 'openPage' })).getAttribute('href')).toBe('https://auth.example/start')
  })
})
