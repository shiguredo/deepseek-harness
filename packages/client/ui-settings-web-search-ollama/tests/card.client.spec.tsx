// @vitest-environment jsdom
/** The Ollama Cloud web page as the Plugins page renders it: its one-liner, its switch, its four controls, and what a save does. */

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
    searchBaseURL: field(''),
    fetchBaseURL: field(''),
    searchPlaceholder: 'https://ollama.com/api/web_search',
    fetchPlaceholder: 'https://ollama.com/api/web_fetch',
    maxResults: field('5'),
    apiKey: field(''),
    apiKeyConfigured: false,
    apiKeyWritable: true,
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

  it('shows its controls at once on its page, without a title of its own', () => {
    renderCard()

    expect(screen.getByLabelText(en.apiKey)).toBeTruthy()
    expect(screen.getByLabelText(en.searchBaseUrl)).toBeTruthy()
    expect(screen.getByLabelText(en.fetchBaseUrl)).toBeTruthy()
    expect(screen.getByLabelText(en.maxResults)).toBeTruthy()
    expect(screen.queryByText(en.title)).toBeNull()
  })

  it('shows each operation its own default endpoint while the field is empty', () => {
    renderCard()

    expect(screen.getByLabelText(en.searchBaseUrl)).toHaveProperty('placeholder', 'https://ollama.com/api/web_search')
    expect(screen.getByLabelText(en.fetchBaseUrl)).toHaveProperty('placeholder', 'https://ollama.com/api/web_fetch')
  })

  it('renders the switch only when the Host serves the selection it writes', () => {
    renderCard()
    expect(screen.getByRole('switch', { name: en.useOllama }).getAttribute('aria-checked')).toBe('false')
    cleanup()

    renderCard({ switchAvailable: false })
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.getByLabelText(en.searchBaseUrl)).toBeTruthy()
  })

  it('stages the switch position and every field edit instead of writing them', () => {
    const actions = renderCard({ useOllama: true })

    expect(screen.getByRole('switch', { name: en.useOllama }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: en.useOllama }))
    fireEvent.change(screen.getByLabelText(en.maxResults), { target: { value: '20' } })

    expect(actions.setOllama).toHaveBeenCalledWith(false)
    expect(actions.edit).toHaveBeenCalledWith('maxResults', '20')
    expect(actions.save).not.toHaveBeenCalled()
  })

  it('stages a key and endpoint edits, and resets the result count it owns', () => {
    const actions = renderCard({ maxResults: field('5', { overridden: true }) })

    fireEvent.change(screen.getByLabelText(en.apiKey), { target: { value: 'sk-test' } })
    fireEvent.change(screen.getByLabelText(en.searchBaseUrl), { target: { value: 'https://search.test' } })
    fireEvent.change(screen.getByLabelText(en.fetchBaseUrl), { target: { value: 'https://fetch.test' } })

    expect(actions.edit).toHaveBeenCalledWith('apiKey', 'sk-test')
    expect(actions.edit).toHaveBeenCalledWith('searchBaseURL', 'https://search.test')
    expect(actions.edit).toHaveBeenCalledWith('fetchBaseURL', 'https://fetch.test')

    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    expect(actions.resetField).toHaveBeenCalledWith('maxResults')
  })

  it('reports whether a key is configured without ever rendering one', () => {
    renderCard({ apiKeyConfigured: false })
    expect(screen.getByText(en.apiKeyUnset)).toBeTruthy()
    cleanup()

    renderCard({ apiKeyConfigured: true })
    expect(screen.getByText(en.apiKeySet)).toBeTruthy()
    expect(screen.getByLabelText(en.apiKey)).toHaveProperty('value', '')
  })

  it('offers the reset for an overridden field only, and addresses each field separately', () => {
    const actions = renderCard({ fetchBaseURL: field('https://gateway.test', { overridden: true }) })

    // One badge and one reset: the search endpoint is still inherited.
    expect(screen.getAllByText(en.overridden)).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    expect(actions.resetField).toHaveBeenCalledWith('fetchBaseURL')
    cleanup()

    const search = renderCard({ searchBaseURL: field('https://search.test', { overridden: true }) })
    fireEvent.click(screen.getByRole('button', { name: en.reset }))
    expect(search.resetField).toHaveBeenCalledWith('searchBaseURL')
  })

  it('keeps the save inert until something is staged, offers no discard, and writes the staged edits when saved', () => {
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

  it('keeps the key writable when only the settings document is read-only', () => {
    // The credentials domain and the settings document are separate stores
    // with separate refusals; the key has its own control for exactly that.
    renderCard({ writable: false, apiKeyWritable: true })

    expect(screen.getByLabelText(en.apiKey)).toHaveProperty('disabled', false)
  })
})
