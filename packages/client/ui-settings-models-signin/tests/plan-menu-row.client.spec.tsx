// @vitest-environment jsdom
/** The model menu's plan row: it states the plan only when a sign-in pays. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlanMenuRow } from '../src/client/PlanMenuRow.tsx'
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

/** Render the row over one flow and one selection. */
function bench(options: { flows?: readonly SignInFlowView[]; provider?: string } = {}) {
  const dismiss = vi.fn()
  const props = {
    dismiss,
    current: { provider: options.provider ?? 'openai-codex', model: 'gpt-6.2-sol' },
    list: vi.fn(async () => [...options.flows ?? [GRANTED]]),
    t,
  } as unknown as Parameters<typeof PlanMenuRow>[0]
  render(<PlanMenuRow {...props} />)
  return { dismiss }
}

describe('PlanMenuRow', () => {
  it('names the plan and offers its usage page when a sign-in pays', async () => {
    bench()

    const row = await screen.findByRole('menuitem')
    expect(row.textContent).toContain('planInUse')
    expect(row.textContent).toContain('manageUsage')
    expect(row.getAttribute('href')).toBe('https://chatgpt.com/settings/usage')
  })

  it('closes the menu when the row is taken', async () => {
    const { dismiss } = bench()

    ;(await screen.findByRole('menuitem')).click()
    expect(dismiss).toHaveBeenCalled()
  })

  it('says nothing when an API key pays for the selection', async () => {
    bench({ flows: [{ ...GRANTED, credential: 'api-key', signedIn: false }] })

    await waitFor(() => { expect(screen.queryByRole('menuitem')).toBeNull() })
  })

  it('says nothing while no selection has resolved', async () => {
    bench({ provider: undefined as unknown as string })

    await waitFor(() => { expect(screen.queryByRole('menuitem')).toBeNull() })
  })

  it('says nothing for a provider no flow serves', async () => {
    bench({ provider: 'anthropic' })

    await waitFor(() => { expect(screen.queryByRole('menuitem')).toBeNull() })
  })
})
