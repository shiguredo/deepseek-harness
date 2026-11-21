// @vitest-environment jsdom
/** The Ollama Cloud web page as the Plugins page renders it: its one-liner, its switch, its result count, and what a save does. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsFieldState, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import { OllamaSearchCard, type OllamaSearchCardProps } from '../src/client/OllamaSearchCard.tsx'
import type { OllamaSearchCardState } from '../src/client/ollama-search-card-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const settled: SettingsFormShell = { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }

function field(text: string, rest: Partial<SettingsFieldState> = {}): SettingsFieldState {
  return { text, overridden: false, invalid: false, ...rest }
}

function renderCard(state: Partial<OllamaSearchCardState> = {}, view: 'summary' | 'page' = 'page') {
  const store = createSnapshotStore<OllamaSearchCardState>({
    ...settled,
    switchAvailable: true,
    useOllama: false,
    maxResults: field('5'),
    apiKeyConfigured: true,
    ...state,
  })
  const actions = { edit: vi.fn(), resetField: vi.fn(), save: vi.fn(), discard: vi.fn(), setOllama: vi.fn() }
  const props = { ...actions, view, t, useOllamaSearchCard: bindSnapshotSelector(store) } as OllamaSearchCardProps
  render(<OllamaSearchCard {...props} />)
  return actions
}

describe('OllamaSearchCard', () => {
  it('renders its one-liner alone in the summary view', () => {
    renderCard({}, 'summary')

    expect(document.body.textContent).toBe(en.description)
    expect(screen.queryByLabelText(en.maxResults)).toBeNull()
  })

  it('says the plugin is not loaded in place of its fields while its namespace is unavailable', () => {
    renderCard({ available: false })

    expect(screen.getByRole('status').textContent).toBe(en.unavailable)
    expect(screen.queryByLabelText(en.maxResults)).toBeNull()
  })

  it('shows the switch and the result count at once, without a title of its own', () => {
    renderCard()

    expect(screen.getByRole('switch', { name: en.useOllama })).toBeTruthy()
    expect(screen.getByLabelText(en.maxResults)).toBeTruthy()
    expect(screen.queryByText(en.title)).toBeNull()
  })

  it('renders the switch only when the Host serves the selection it writes', () => {
    renderCard()
    expect(screen.getByRole('switch', { name: en.useOllama }).getAttribute('aria-checked')).toBe('false')
    cleanup()

    renderCard({ switchAvailable: false })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByLabelText(en.maxResults)).toBeTruthy()
  })

  it('stages the switch position and the result count instead of writing them', () => {
    const actions = renderCard({ useOllama: true })

    expect(screen.getByRole('switch', { name: en.useOllama }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: en.useOllama }))
    fireEvent.change(screen.getByLabelText(en.maxResults), { target: { value: '20' } })

    expect(actions.setOllama).toHaveBeenCalledWith(false)
    expect(actions.edit).toHaveBeenCalledWith('maxResults', '20')
    expect(actions.save).not.toHaveBeenCalled()
  })

  it('resets the result count it owns when the stored value overrides the default', () => {
    const actions = renderCard({ maxResults: field('9', { overridden: true }) })

    expect(screen.getByText(en.overridden)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    expect(actions.resetField).toHaveBeenCalledWith('maxResults')
  })

  it('points at the model settings while no key is configured, and stops once one is', () => {
    renderCard({ apiKeyConfigured: false })
    expect(screen.getByText(en.apiKeyUnset)).toBeTruthy()
    cleanup()

    renderCard({ apiKeyConfigured: true })
    expect(screen.queryByText(en.apiKeyUnset)).toBeNull()
  })

  it('keeps the switch off-limits until a key is configured, but still lets it turn off', () => {
    renderCard({ apiKeyConfigured: false, useOllama: false })
    expect(screen.getByRole('switch', { name: en.useOllama })).toHaveProperty('disabled', true)
    cleanup()

    // The key can disappear after the pair was selected; that selection must
    // stay reversible from this page.
    renderCard({ apiKeyConfigured: false, useOllama: true })
    expect(screen.getByRole('switch', { name: en.useOllama })).toHaveProperty('disabled', false)
    cleanup()

    renderCard({ apiKeyConfigured: true, useOllama: false })
    expect(screen.getByRole('switch', { name: en.useOllama })).toHaveProperty('disabled', false)
  })

  it('keeps the save inert until something is staged and writes the staged edits when saved', () => {
    renderCard()
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', true)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    cleanup()

    const actions = renderCard({ dirty: true })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect(actions.save).toHaveBeenCalledOnce()
    expect(actions.discard).not.toHaveBeenCalled()
  })

  it('drops the staged edits when it leaves the page', () => {
    const actions = renderCard({ dirty: true })
    expect(actions.discard).not.toHaveBeenCalled()

    cleanup()

    expect(actions.discard).toHaveBeenCalledOnce()
  })

  it('blocks the save while a draft is invalid and says why, reports a save in flight, and a save the deployment refused', () => {
    renderCard({ dirty: true, invalid: true, maxResults: field('many', { invalid: true }) })
    expect(screen.getByRole('button', { name: en.save })).toHaveProperty('disabled', true)
    expect(screen.getByText(en.invalidNumber)).toBeTruthy()
    cleanup()

    renderCard({ dirty: true, saving: true })
    expect(screen.getByRole('button', { name: en.saving })).toHaveProperty('disabled', true)
    cleanup()

    renderCard({ dirty: true, failed: true })
    expect(screen.getByText(en.saveFailed)).toBeTruthy()
    expect(screen.getByLabelText(en.maxResults)).toBeTruthy()
  })

  it('says the document is read-only and disables its controls', () => {
    renderCard({ writable: false })

    expect(screen.getByRole('status')).toHaveProperty('textContent', en.readOnly)
    expect(screen.getByLabelText(en.maxResults)).toHaveProperty('disabled', true)
    expect(screen.getByRole('switch', { name: en.useOllama })).toHaveProperty('disabled', true)
  })
})
