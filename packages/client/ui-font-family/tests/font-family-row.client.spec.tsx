// @vitest-environment jsdom
/** FontFamilyRow behavior: persisted value display, Enter/blur commits, empty
 * clearing, rejected text kept for correction, and external mirror updates. */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { FontFamilyRow } from '../src/client/FontFamilyRow.tsx'
import type { FontFamilyRowComponentProps } from '../src/client/FontFamilyRow.tsx'
import { createFontFamilyRowStore } from '../src/client/settings-store.ts'

// Every fixture carries the resource hook the resources plugin merges into GlobalStandardProps.
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })

afterEach(cleanup)

const COPY: Record<string, string> = {
  'fontFamily.title': 'Font',
  'fontFamily.description': 'Applies to UI text and code; leave empty for the browser default',
  'fontFamily.placeholder': 'e.g. "Hiragino Sans", "Noto Sans JP"',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceSnapshot>({
    items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  })
  return bindSnapshotSelector(store)
}

type AttentionSnapshot = Parameters<Parameters<FontFamilyRowComponentProps['useSessionStatus']>[0]>[0]
const noAttention: AttentionSnapshot = new Map()
const useSessionStatus: FontFamilyRowComponentProps['useSessionStatus'] = selector => selector(noAttention)

function mount(
  fontFamily = '',
  setFontFamily: FontFamilyRowComponentProps['setFontFamily'] = vi.fn(),
) {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createFontFamilyRowStore().create()
  store.actions.sync(fontFamily, 0)
  const props: FontFamilyRowComponentProps = {
    useSessions: emptySessions(),
    useSessionStatus,
    useSessionRetainInfo: () => undefined,
    usePanelInfo, useResource,
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    setFontFamily,
  }
  const view = render(<FontFamilyRow {...props} />)
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Font' })
  return { store, setFontFamily, input, view, props }
}

describe('FontFamilyRow', () => {
  it('renders the title, description, and the persisted family with a placeholder when empty', () => {
    mount('"Hiragino Sans"')
    expect(screen.getByText('Font')).toBeDefined()
    expect(screen.getByText('Applies to UI text and code; leave empty for the browser default')).toBeDefined()
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Font' })
    expect(input.value).toBe('"Hiragino Sans"')
    expect(input.maxLength).toBe(256)
    cleanup()
    const empty = mount()
    expect(empty.input.value).toBe('')
    expect(empty.input.placeholder).toBe('e.g. "Hiragino Sans", "Noto Sans JP"')
  })

  it('commits typed text on blur and clears the override when emptied', () => {
    const b = mount('"Old Font"')
    fireEvent.change(b.input, { target: { value: '"New Font", sans-serif' } })
    expect(b.setFontFamily).not.toHaveBeenCalled()
    fireEvent.blur(b.input)
    expect(b.setFontFamily).toHaveBeenCalledWith('"New Font", sans-serif')
    fireEvent.change(b.input, { target: { value: '' } })
    fireEvent.blur(b.input)
    expect(b.setFontFamily).toHaveBeenLastCalledWith('')
  })

  it('commits on Enter and leaves the field on success', () => {
    const b = mount()
    fireEvent.change(b.input, { target: { value: 'Custom Font' } })
    fireEvent.keyDown(b.input, { key: 'Enter' })
    expect(b.setFontFamily).toHaveBeenCalledWith('Custom Font')
    expect(document.activeElement).not.toBe(b.input)
  })

  it('ignores other keys and keeps focus on a rejected Enter commit', () => {
    const rejecting = vi.fn(() => { throw new Error('not a font family') })
    const b = mount('', rejecting)
    b.input.focus()
    fireEvent.change(b.input, { target: { value: 'broken' } })
    fireEvent.keyDown(b.input, { key: 'a' })
    expect(rejecting).not.toHaveBeenCalled()
    fireEvent.keyDown(b.input, { key: 'Enter' })
    expect(rejecting).toHaveBeenCalledWith('broken')
    expect(document.activeElement).toBe(b.input)
    expect(b.input.getAttribute('aria-invalid')).toBe('true')
  })

  it('keeps text the service rejects, marks the field invalid, and recovers after correction', () => {
    const rejecting = vi.fn(() => { throw new Error('not a font family') })
    const b = mount('', rejecting)
    fireEvent.change(b.input, { target: { value: 'broken ; value' } })
    fireEvent.blur(b.input)
    expect(rejecting).toHaveBeenCalledWith('broken ; value')
    expect(b.input.value).toBe('broken ; value')
    expect(b.input.getAttribute('aria-invalid')).toBe('true')
    // Correction through a service that accepts it clears the invalid state.
    const accepting = vi.fn()
    b.view.rerender(<FontFamilyRow {...b.props} setFontFamily={accepting} />)
    fireEvent.change(b.input, { target: { value: '"Fixed Font"' } })
    fireEvent.blur(b.input)
    expect(accepting).toHaveBeenCalledWith('"Fixed Font"')
    expect(b.input.getAttribute('aria-invalid')).toBeNull()
  })

  it('adopts an externally changed mirror value into the field', () => {
    const b = mount('"First Font"')
    fireEvent.change(b.input, { target: { value: 'typed but uncommitted' } })
    act(() => { b.store.actions.sync('"Second Font"', 1) })
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Font' }).value).toBe('"Second Font"')
  })
})
