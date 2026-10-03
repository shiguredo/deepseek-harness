// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { ClockTimeZone } from '../src/chat-settings.ts'
import { ClockTimeZoneRow, type ClockTimeZoneRowProps } from '../src/client/settings/ClockTimeZoneRow.tsx'
import { en, zh } from '../src/client/locale.ts'

afterEach(cleanup)

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, phase: 'ready', projectionsBySession: {},
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceSnapshot>({
    items: [], archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }))
}

function noPendingInteraction() {
  return bindSnapshotSelector(createSnapshotStore<SessionStatusSnapshot>(new Map()))
}

// The resource hook the resources plugin merges into GlobalStandardProps; this row reads no address.
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined })) as GlobalStandardProps['useResource']

function mount(zone: ClockTimeZone = 'local', dictionary: typeof en | typeof zh = en) {
  const source = createSnapshotStore<ClockTimeZone>(zone)
  const setClockTimeZone = vi.fn((next: ClockTimeZone) => { source.set(next) })
  const props: ClockTimeZoneRowProps = {
    usePanelInfo: selector => selector({ activePanelId: null }),
    useSessions: emptySessions(),
    useSessionStatus: noPendingInteraction(),
    useWorkspaces: emptyWorkspaces(),
    useSessionRetainInfo: () => undefined,
    useResource,
    useClockTimeZone: bindSnapshotSelector(source),
    setClockTimeZone,
    t: makeTranslate(dictionary),
  }
  render(<ClockTimeZoneRow {...props} />)
  return { setClockTimeZone }
}

describe('ClockTimeZoneRow', () => {
  it('shows the device zone by default and offers every pinned zone', () => {
    const b = mount()
    expect(screen.getByText('Timestamp time zone')).toBeDefined()
    expect(screen.getByText('Time zone the message timestamps use')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Device time zone' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Japan Standard Time (JST)' }))
    expect(b.setClockTimeZone).toHaveBeenCalledWith('jst')
    fireEvent.click(screen.getByRole('button', { name: 'Japan Standard Time (JST)' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Coordinated Universal Time (UTC)' }))
    expect(b.setClockTimeZone).toHaveBeenLastCalledWith('utc')
  })

  it('follows the mirrored value and localizes every label', () => {
    const b = mount('utc', zh)
    expect(screen.getByText('时间戳时区')).toBeDefined()
    expect(screen.getByText('消息时间戳使用的时区')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: '协调世界时（UTC）' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '设备时区' }))
    expect(b.setClockTimeZone).toHaveBeenCalledWith('local')
    expect(screen.getByRole('button', { name: '设备时区' })).toBeDefined()
  })
})
