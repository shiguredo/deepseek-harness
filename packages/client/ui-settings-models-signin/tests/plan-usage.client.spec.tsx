// @vitest-environment jsdom
/** The composer's plan line: it speaks for a plan-paid selection and routes a limit to ChatGPT. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlanUsage } from '../src/client/PlanUsage.tsx'
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

/** Render the line over one flow and one Session state. */
function bench(options: {
  flows?: readonly SignInFlowView[]
  provider?: string
  lastAgentError?: string | null
} = {}) {
  const flows = options.flows ?? [GRANTED]
  const props = {
    session: { lastAgentError: options.lastAgentError ?? null },
    useProjection: () => ({
      next: { provider: options.provider ?? 'openai-codex', model: 'gpt-5-codex' },
      lastUsed: null,
    }),
    list: vi.fn(async () => [...flows]),
    t,
  } as unknown as Parameters<typeof PlanUsage>[0]
  render(<PlanUsage {...props} />)
  return props
}

describe('PlanUsage', () => {
  it('says nothing while the plan simply pays for the selected model', async () => {
    bench()

    // The composer stays quiet about a working plan; there is nothing to act on.
    await waitFor(() => { expect(screen.queryByRole('link')).toBeNull() })
    expect(screen.queryByText('planLimitTitle')).toBeNull()
  })

  it('says nothing when an API key pays for the selected model', async () => {
    bench({ flows: [{ ...GRANTED, credential: 'api-key', signedIn: false }], lastAgentError: 'subscription_sharing_usage_limit_exceeded' })

    await waitFor(() => { expect(screen.queryByText('planLimitTitle')).toBeNull() })
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('says nothing for a provider no flow serves', async () => {
    bench({ provider: 'anthropic', lastAgentError: 'subscription_sharing_usage_limit_exceeded' })

    await waitFor(() => { expect(screen.queryByText('planLimitTitle')).toBeNull() })
  })

  it('routes a plan usage-limit failure to ChatGPT settings', async () => {
    bench({ lastAgentError: '400 subscription_sharing_usage_limit_exceeded: limit reached' })

    expect(await screen.findByText('planLimitTitle')).toBeTruthy()
    expect(screen.getByText('planLimitBody')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'manageUsage' }).getAttribute('href'))
      .toBe('https://chatgpt.com/settings/usage')
  })
})
