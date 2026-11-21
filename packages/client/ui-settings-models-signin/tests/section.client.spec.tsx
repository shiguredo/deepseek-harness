// @vitest-environment jsdom
/** The provider-card section: it reads the flows once, starts one, and shows the flow's question. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SignInSection } from '../src/client/SignInSection.tsx'
import type { ModelSignInFace } from '../src/client/face.ts'
import type { ModelsSignInLocaleKey } from '../src/client/locales.ts'
import type { SignInAttemptView, SignInFlowView } from '../src/types.ts'

afterEach(cleanup)

const t = (key: ModelsSignInLocaleKey): string => key

const FLOW: SignInFlowView = {
  key: 'llm-pi-ai/openai-codex',
  provider: 'openai-codex',
  label: 'OpenAI (ChatGPT plan)',
  methods: [{ id: 'oauth', label: 'OpenAI (ChatGPT plan)' }],
  signedIn: false,
  credential: 'none',
}

/** A pending question, as the codex flow asks before it opens its browser step. */
const ATTEMPT: SignInAttemptView = {
  id: 'attempt-1', key: FLOW.key, method: 'oauth', phase: 'waiting',
  notices: [],
  prompt: {
    id: 1, kind: 'select', message: 'Select OpenAI Codex login method:',
    options: [{ id: 'browser', label: 'Browser login (default)' }, { id: 'device_code', label: 'Device code login (headless)' }],
  },
}

/** Render one card with a fake face over the given flow. */
function bench(flows: readonly SignInFlowView[] = [FLOW], configured = false, editing = true) {
  const list = vi.fn(async () => [...flows])
  const begin = vi.fn(async () => ATTEMPT)
  const poll = vi.fn(async () => ATTEMPT)
  const answer = vi.fn(async () => ATTEMPT)
  const cancel = vi.fn(async () => ATTEMPT)
  const signOut = vi.fn(async () => undefined)
  const face: ModelSignInFace = { list, begin, poll, answer, cancel, signOut }
  // The card's directory row, the localized copy, and the face are the three
  // prop families the Models page binds; the spec supplies each directly.
  const props = {
    provider: { provider: 'openai-codex', configured, keyConfigured: false },
    configured,
    editing,
    t,
    ...face,
  } as unknown as Parameters<typeof SignInSection>[0]
  render(<SignInSection {...props} />)
  return face
}

describe('SignInSection', () => {
  it('reads the flows once and offers the flow method label', async () => {
    const { list } = bench()

    await screen.findByRole('button', { name: 'OpenAI (ChatGPT plan)' })
    // A re-render must not turn the read into a poll loop.
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(list).toHaveBeenCalledTimes(1)
  })

  it('offers no action on a collapsed row, where nothing is open for editing', async () => {
    bench([FLOW], false, false)

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByRole('button', { name: 'OpenAI (ChatGPT plan)' })).toBeNull()
  })

  it('renders nothing for a provider no flow serves', async () => {
    const { list } = bench([])

    await waitFor(() => { expect(list).toHaveBeenCalled() })
    expect(screen.queryByRole('button', { name: 'OpenAI (ChatGPT plan)' })).toBeNull()
  })

  it('says what the browser step will ask for before it starts', async () => {
    bench()

    expect(await screen.findByText('startHint')).toBeTruthy()
  })

  it('says a signed-in draft is not usable until it is saved', async () => {
    bench([{ ...FLOW, signedIn: true }])

    expect(await screen.findByText('saveHint')).toBeTruthy()
  })

  it('shows the flow question after the sign-in starts', async () => {
    const { begin, answer } = bench()

    fireEvent.click(await screen.findByRole('button', { name: 'OpenAI (ChatGPT plan)' }))

    expect(await screen.findByText('Select OpenAI Codex login method:')).toBeTruthy()
    expect(begin).toHaveBeenCalledWith(FLOW.key, 'oauth')
    fireEvent.click(screen.getByRole('button', { name: 'Device code login (headless)' }))
    await waitFor(() => { expect(answer).toHaveBeenCalledWith('attempt-1', 1, 'device_code') })
  })
})
