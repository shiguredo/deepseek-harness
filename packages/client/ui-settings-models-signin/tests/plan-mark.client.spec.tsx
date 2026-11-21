// @vitest-environment jsdom
/** The row mark: an account sign-in's presence, where the credential dot sits. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlanMark } from '../src/client/PlanMark.tsx'
import type { ModelsSignInLocaleKey } from '../src/client/locales.ts'
import type { SignInFlowView } from '../src/types.ts'

afterEach(cleanup)

const t = (key: ModelsSignInLocaleKey): string => key

/** One flow whose stored record came from a sign-in. */
const GRANTED: SignInFlowView = {
  key: 'llm-pi-ai/openai-codex',
  provider: 'openai-codex',
  label: 'OpenAI (ChatGPT plan)',
  methods: [{ id: 'oauth', label: 'OpenAI (ChatGPT plan)' }],
  signedIn: true,
  credential: 'grant',
}

/** Render the mark for one row. */
function bench(flow: SignInFlowView | undefined = GRANTED) {
  const props = {
    provider: { provider: 'openai-codex' },
    list: vi.fn(async () => flow === undefined ? [] : [flow]),
    t,
  } as unknown as Parameters<typeof PlanMark>[0]
  render(<PlanMark {...props} />)
}

describe('PlanMark', () => {
  it('marks a row an account sign-in supplies', async () => {
    bench()

    expect(await screen.findByRole('img', { name: 'accountMark' })).toBeTruthy()
    expect(screen.getByText('accountMark')).toBeTruthy()
  })

  it('leaves a row unmarked while no sign-in supplies it', async () => {
    bench({ ...GRANTED, signedIn: false, credential: 'none' })

    await waitFor(() => { expect(screen.queryByRole('img', { name: 'accountMark' })).toBeNull() })
  })

  it('leaves an api-key row to the page\'s own dot', async () => {
    bench({ ...GRANTED, signedIn: false, credential: 'api-key' })

    await waitFor(() => { expect(screen.queryByRole('img', { name: 'accountMark' })).toBeNull() })
  })
})
