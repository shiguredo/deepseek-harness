// @vitest-environment jsdom
/** The model row's peak-routing control: destination, window, and clearing. */
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelListEditor } from '../src/client/ModelListEditor.tsx'
import { routingDraftOf } from '../src/client/ModelRow.tsx'
import type { ModelsOperations } from '../src/client/operations.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const operations: ModelsOperations = {
  discoverModels: vi.fn(),
  storeCredential: vi.fn(),
  removeCredential: vi.fn(),
  writeSettings: vi.fn(),
}

const providers = [
  { id: 'opencode-go', name: 'OpenCode Go', models: ['deepseek-v4.1-flash'] },
  { id: 'opencode', name: 'OpenCode Zen', models: ['deepseek-v4.1-flash'] },
  { id: 'ollama-cloud', name: 'Ollama Cloud', models: ['deepseek-v4.1-flash'] },
  // Serves a different id, so a model chosen on another destination does not
  // carry over when the destination changes.
  { id: 'kimi', name: 'Kimi', models: ['kimi-k3'] },
]

/**
 * Render one pi-ai model list and expand one row. The list is held in React
 * state, so a sequence of edits sees each one land — which is what the
 * destination-then-model flow needs.
 * @param initial - the models the row starts with.
 * @param onChange - observes every committed list.
 * @param provider - provider whose catalog the list edits.
 * @param row - 1-based row to expand.
 * @returns the last committed list.
 */
function editor(
  initial: Record<string, unknown>[],
  onChange: (next: Record<string, unknown>[]) => void = vi.fn(),
  provider = 'ollama-cloud',
  row = 1,
): { last: () => Record<string, unknown>[] } {
  let current = initial
  function Harness(): React.JSX.Element {
    const [models, setModels] = useState(initial)
    current = models
    return <ModelListEditor
      models={models}
      onChange={(next) => {
        setModels(next)
        onChange(next)
      }}
      routingProviders={providers}
      probe={{ settingsNs: 'llm-pi-ai', provider }}
      disabled={false}
      t={key => en[key]}
      onBusyChange={() => {}}
      operations={operations}
    />
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: `${en.modelAdvanced} ${String(row)}` }))
  return { last: () => current }
}

/** Choose a destination provider, then the model it serves. */
function chooseDestination(provider: string, model: string): void {
  fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: provider } })
  fireEvent.change(screen.getByLabelText(`${en.routingModel} 1`), { target: { value: model } })
}

describe('routingDraftOf', () => {
  it('reads a declared destination', () => {
    expect(routingDraftOf({
      peak: [{ provider: 'opencode-go', model: 'kimi-k3' }],
    })).toEqual({ provider: 'opencode-go', model: 'kimi-k3' })
  })

  it('carries the destination credential reference', () => {
    expect(routingDraftOf({
      peak: [{ provider: 'opencode-go', model: 'kimi-k3', apiKeyEnv: 'OPENCODE_GO_API_KEY' }],
    })).toEqual({
      provider: 'opencode-go',
      model: 'kimi-k3',
      apiKeyEnv: 'OPENCODE_GO_API_KEY',
    })
  })

  it('reads a legacy entry that still stores a period', () => {
    // The schema passes unknown keys through, so an entry written before the
    // period moved into the catalog data still reads as its destination.
    expect(routingDraftOf({
      peak: [{
        from: '22:00',
        to: '05:00',
        timeZone: 'UTC',
        days: ['sat', 'sun'],
        provider: 'opencode-go',
        model: 'kimi-k3',
      }],
    })).toEqual({ provider: 'opencode-go', model: 'kimi-k3' })
  })

  it('reads an absent or malformed declaration as none', () => {
    const none = { provider: '', model: '' }
    expect(routingDraftOf({})).toEqual(none)
    expect(routingDraftOf({ peak: [] })).toEqual(none)
    expect(routingDraftOf({ peak: [{}] })).toEqual(none)
  })

  it('reads a stored destination that names no model as an incomplete one', () => {
    // Hand-written configuration may move only the endpoint. The editor cannot
    // express that, so the row shows a destination that still needs a model.
    expect(routingDraftOf({ peak: [{ provider: 'opencode-go' }] }))
      .toMatchObject({ provider: 'opencode-go', model: '' })
  })
})

describe('peak routing destination', () => {
  it('offers the control on an Ollama Cloud DeepSeek row', () => {
    editor([{ id: 'deepseek-v4.1-flash:1017' }])
    expect(screen.getByText(en.peakRouting)).toBeTruthy()
    expect(screen.getByRole('option', { name: 'OpenCode Go', hidden: true })).toBeTruthy()
  })

  it('offers the control on the other DeepSeek entry of that route', () => {
    editor([{ id: 'deepseek-v4-pro:0813' }])
    expect(screen.getByText(en.peakRouting)).toBeTruthy()
  })

  it.each([
    { label: 'a non-DeepSeek model on Ollama Cloud', id: 'glm-5.3-flash', provider: 'ollama-cloud' },
    { label: 'a DeepSeek model on another provider', id: 'deepseek-v4.1-flash', provider: 'opencode-go' },
  ])('offers no control on $label', ({ id, provider }) => {
    editor([{ id }], vi.fn(), provider)
    expect(screen.queryByText(en.peakRouting)).toBeNull()
  })

  it('defaults the destination to none and lists every provider except the row’s own', () => {
    editor([{ id: 'deepseek-v4.1-flash:1017' }])
    const select = screen.getByLabelText<HTMLSelectElement>(`${en.routingProvider} 1`)
    expect(select.value).toBe('')
    expect(screen.getByRole('option', { name: en.routingNone, hidden: true })).toBeTruthy()
    for (const option of providers.filter(entry => entry.id !== 'ollama-cloud')) {
      expect(screen.getByRole('option', { name: option.name, hidden: true })).toBeTruthy()
    }
    // A window moves the request elsewhere; the route cannot be its own
    // destination, and the adapter refuses it.
    expect(screen.queryByRole('option', { name: 'Ollama Cloud', hidden: true })).toBeNull()
  })

  it('asks for a destination model instead of offering the routed one', () => {
    editor([{ id: 'deepseek-v4.1-flash:1017' }])
    // No "same model" shortcut: the prompt is a disabled entry, so a
    // destination model is always something the user picked.
    const prompt = screen.getByRole('option', { name: en.routingModelPlaceholder, hidden: true })
    expect(prompt).toHaveProperty('disabled', true)
  })

  it('waits for a destination before offering a destination model', () => {
    editor([{ id: 'deepseek-v4.1-flash:1017' }])
    expect(screen.getByLabelText<HTMLSelectElement>(`${en.routingModel} 1`).disabled).toBe(true)
  })

  it('offers the destination provider’s own catalog once one is chosen', () => {
    editor([{ id: 'deepseek-v4.1-flash:1017' }])
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: 'kimi' } })
    const select = screen.getByLabelText<HTMLSelectElement>(`${en.routingModel} 1`)
    expect(select.disabled).toBe(false)
    expect(screen.getByRole('option', { name: 'kimi-k3', hidden: true })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'deepseek-v4.1-flash', hidden: true })).toBeNull()
  })

  it('writes no window until the destination names a model', () => {
    const onChange = vi.fn()
    editor([{ id: 'deepseek-v4.1-flash:1017' }], onChange)
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: 'opencode-go' } })
    // A provider without a model would route the routed model's own id, which
    // is the choice this control deliberately does not offer.
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'deepseek-v4.1-flash:1017' }])
    expect(screen.queryByText(en.routingWindow)).toBeNull()
  })

  it('writes the destination alone once the model completes it', () => {
    const onChange = vi.fn()
    editor([{ id: 'deepseek-v4.1-flash:1017' }], onChange)
    chooseDestination('opencode-go', 'deepseek-v4.1-flash')
    // The period is the model's published price policy and lives with the
    // catalog data, so no hours reach the settings document.
    expect(onChange).toHaveBeenLastCalledWith([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }])
  })

  it('keeps the model while the destination changes to a provider serving it', () => {
    const onChange = vi.fn()
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }], onChange)
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: 'opencode' } })
    // The day/night pair this control exists for usually shares one id, so the
    // chosen model survives the switch.
    expect(onChange).toHaveBeenLastCalledWith([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode', model: 'deepseek-v4.1-flash' }],
    }])
  })

  it('drops a model the new destination does not serve, and the destination with it', () => {
    const onChange = vi.fn()
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }], onChange)
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: 'kimi' } })
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'deepseek-v4.1-flash:1017' }])
    expect(screen.queryByText(en.routingWindow)).toBeNull()
  })

  it('clears the destination when it is removed', () => {
    const onChange = vi.fn()
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }], onChange)
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith([{ id: 'deepseek-v4.1-flash:1017' }])
    expect(screen.getByText(en.routingHint)).toBeTruthy()
  })

  it('keeps a stored destination the catalog no longer lists', () => {
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'retired', model: 'some-model' }],
    }])
    expect(screen.getByLabelText<HTMLSelectElement>(`${en.routingProvider} 1`).value).toBe('retired')
    expect(screen.getByRole('option', { name: 'retired', hidden: true })).toBeTruthy()
  })

  it('offers no control when the deployment configures no destination', () => {
    render(<ModelListEditor
      models={[{ id: 'deepseek-v4.1-flash:1017' }]}
      onChange={vi.fn()}
      probe={{ settingsNs: 'llm-pi-ai', provider: 'ollama-cloud' }}
      disabled={false}
      t={key => en[key]}
      onBusyChange={() => {}}
      operations={operations}
    />)
    fireEvent.click(screen.getByRole('button', { name: `${en.modelAdvanced} 1` }))
    expect(screen.queryByText(en.peakRouting)).toBeNull()
  })
})

describe('peak routing period statement', () => {
  it('states the window in UTC and JST instead of offering time inputs', () => {
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }])
    // The period is policy the catalog data carries, so it is read, not edited.
    const stated = screen.getByText(en.routingWindow).closest('div')!
    expect(within(stated).queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.getByText('12:00–18:00 UTC / 21:00–03:00 JST · weekdays (Mon–Fri)')).toBeTruthy()
  })

  it('states the published peak definition, weekends included', () => {
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    }])
    // Ollama Cloud prices weekends off-peak all day, so no window covers one.
    expect(screen.getByText(en.routingPeakNote)).toBeTruthy()
    expect(en.routingPeakNote).toContain('Weekends are off-peak all day')
  })

  it('keeps the destination credential while the same destination is kept', () => {
    const onChange = vi.fn()
    editor([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash', apiKeyEnv: 'OPENCODE_GO_API_KEY' }],
    }], onChange)
    fireEvent.change(screen.getByLabelText(`${en.routingProvider} 1`), { target: { value: 'opencode' } })
    expect(onChange).toHaveBeenLastCalledWith([{
      id: 'deepseek-v4.1-flash:1017',
      peak: [{ provider: 'opencode', model: 'deepseek-v4.1-flash' }],
    }])
  })
})
