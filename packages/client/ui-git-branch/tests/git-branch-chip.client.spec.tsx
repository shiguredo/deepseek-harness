/** Chip presentation: what it folds, when it renders, and its watch lifecycle. */
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { allowAllAccess, bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceGitGithub, WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'
import { GitBranchChip, gitBranchReading, type GitBranchChipProps } from '../src/client/GitBranchChip.tsx'
import { zh } from '../src/client/locales.ts'

const SESSION = 'session' as SessionId
const t: GitBranchChipProps['t'] = makeTranslate(zh)

// Every fixture carries the resource hook the resources plugin merges into GlobalStandardProps.
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined, reload: () => {} })) as GlobalStandardProps['useResource']
const usePanelInfo: GlobalStandardProps['usePanelInfo'] = selector => selector({ activePanelId: null })

type AttentionSnapshot = Parameters<Parameters<GitBranchChipProps['useSessionStatus']>[0]>[0]
const noAttention: AttentionSnapshot = new Map()
const useSessionStatus: GitBranchChipProps['useSessionStatus'] = selector => selector(noAttention)

/** Empty global and session standard-kit hooks (the chip reads its own props only). */
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

const GITHUB: WorkspaceGitGithub = { slug: 'shiguredo/moqt-js', url: 'https://github.com/shiguredo/moqt-js' }

afterEach(() => {
  cleanup()
})

/** One chip over a published checkout record with recorded watch verbs. */
function bench(initial: WorkspaceGitStatus | undefined, workingDirectory: string | null = null): {
  branches: ReturnType<typeof createSnapshotStore<Record<SessionId, WorkspaceGitStatus | undefined>>>
  acquire: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
  refresh: ReturnType<typeof vi.fn>
  props: GitBranchChipProps
} {
  const branches = createSnapshotStore<Record<SessionId, WorkspaceGitStatus | undefined>>({ [SESSION]: initial })
  const acquire = vi.fn()
  const release = vi.fn()
  const refresh = vi.fn()
  function useGitBranch<R>(select: (state: Record<SessionId, WorkspaceGitStatus | undefined>) => R): R {
    return select(branches.getSnapshot())
  }
  return {
    branches,
    acquire,
    release,
    refresh,
    props: {
      ...allowAllAccess,
      sessionId: SESSION,
      useGitBranch,
      acquire,
      release,
      refresh,
      t,
      // The chip reads its own owner data only; every standard seat is a stub.
      useSession: () => { throw new Error('GitBranchChip does not read the session snapshot') },
      useProjection: (key: string) => key === 'workingDirectory' ? workingDirectory : undefined,
      useConversation: () => { throw new Error('GitBranchChip does not read the conversation snapshot') },
      useInput: () => { throw new Error('GitBranchChip does not read the input snapshot') },
      useChat: () => { throw new Error('GitBranchChip does not read the chat snapshot') },
      inputActions: {
        insertQuote: () => false,
        captureInsertion: () => ({ start: 0, end: 0, draftRev: 0 }),
        insertText: () => false,
        setDraft: vi.fn(),
        persistDraft: vi.fn(),
        addAttachments: vi.fn(() => true),
        removeAttachment: vi.fn(),
        pruneAttachments: vi.fn(),
        submit: vi.fn(),
      } satisfies GitBranchChipProps['inputActions'],
      useTrajectory: () => { throw new Error('GitBranchChip does not read the trajectory snapshot') },
      useSessions: emptySessions(),
      useSessionStatus,
      useSessionRetainInfo: () => undefined,
      usePanelInfo,
      useResource,
      useWorkspaces: emptyWorkspaces(),
    },
  }
}

describe('gitBranchReading', () => {
  it('qualifies the ref with the GitHub slug and drops an unavailable checkout', () => {
    expect(gitBranchReading({ kind: 'none' })).toBeNull()
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: null, root: null, github: null }))
      .toEqual({ ref: 'main', name: 'main', repositoryUrl: null, worktree: null, root: null, detached: false })
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: 'moqt-js-feature', root: '/srv/moqt-js-feature', github: GITHUB }))
      .toEqual({
        ref: 'shiguredo/moqt-js:main',
        name: 'main',
        repositoryUrl: GITHUB.url,
        worktree: 'moqt-js-feature',
        root: '/srv/moqt-js-feature',
        detached: false,
      })
    expect(gitBranchReading({ kind: 'detached', head: 'abc1234', worktree: null, root: null, github: null }))
      .toEqual({ ref: 'abc1234', name: 'abc1234', repositoryUrl: null, worktree: null, root: null, detached: true })
  })

  it('keeps the worktree directory and path even when the directory repeats the repository name', () => {
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: 'moqt-js', root: '/srv/moqt-js', github: GITHUB }))
      .toEqual({
        ref: 'shiguredo/moqt-js:main',
        name: 'main',
        repositoryUrl: GITHUB.url,
        worktree: 'moqt-js',
        root: '/srv/moqt-js',
        detached: false,
      })
  })
})

describe('GitBranchChip', () => {
  it('renders nothing before an answer and outside a repository', () => {
    const pending = bench(undefined)
    const first = render(<GitBranchChip {...pending.props} />)
    expect(first.container.innerHTML).toBe('')
    first.unmount()

    const outside = bench({ kind: 'none' })
    const second = render(<GitBranchChip {...outside.props} />)
    expect(second.container.innerHTML).toBe('')
  })

  it('renders a summary trigger that opens a dialog listing every checkout fact', () => {
    const { props } = bench({ kind: 'branch', name: 'feature/x', worktree: 'moqt-js-feature', root: '/srv/moqt-js-feature', github: GITHUB })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('button', { name: '分支 shiguredo/moqt-js:feature/x (工作树 moqt-js-feature) 位于 /srv/moqt-js-feature' })
    expect(chip.textContent).toBe('shiguredo/moqt-js:feature/x (moqt-js-feature) · /srv/moqt-js-feature')
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
    expect(chip.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(chip)
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('检出')
    // Portaled out of the composer dock.
    expect(dialog.parentElement).toBe(document.body)
    expect(dialog.textContent).toContain('分支feature/x')
    expect(dialog.textContent).toContain('工作树moqt-js-feature')
    expect(dialog.textContent).toContain('路径/srv/moqt-js-feature')
    expect(dialog.textContent).toContain('仓库https://github.com/shiguredo/moqt-js')
  })

  it('names a detached HEAD as a commit row and marks a missing repository', () => {
    const { props } = bench({ kind: 'detached', head: 'abc1234', worktree: null, root: null, github: null })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('button', { name: '游离 HEAD abc1234' })
    expect(chip.textContent).toBe('abc1234')
    fireEvent.click(chip)
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('提交abc1234')
    // A bare repository reports neither worktree row; the repository row keeps its placeholder.
    expect(dialog.textContent).not.toContain('工作树')
    expect(dialog.textContent).toContain('仓库—')
  })

  it('closes the dialog on Escape or an outside pointerdown', () => {
    const { props } = bench({ kind: 'branch', name: 'main', worktree: null, root: null, github: null })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('button', { name: '分支 main' })
    fireEvent.click(chip)
    expect(screen.queryByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(chip.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(chip)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the worktree name and path when the directory repeats the repository name', () => {
    const { props } = bench({ kind: 'branch', name: 'main', worktree: 'moqt-js', root: '/srv/moqt-js', github: GITHUB })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('button', { name: '分支 shiguredo/moqt-js:main (工作树 moqt-js) 位于 /srv/moqt-js' })
    expect(chip.textContent).toBe('shiguredo/moqt-js:main (moqt-js) · /srv/moqt-js')
  })

  it('re-reads at once when the projected working directory changes', () => {
    const { refresh, props } = bench(
      { kind: 'branch', name: 'main', worktree: null, root: '/srv/main', github: null },
      '/srv/main',
    )
    const view = render(<GitBranchChip {...props} />)
    // Mount acquires and refreshes; the baseline projection landing is the same value.
    expect(refresh).toHaveBeenCalledTimes(1)
    view.rerender(<GitBranchChip {...props} />)
    expect(refresh).toHaveBeenCalledTimes(1)
    // Entering a worktree changes the projection, so the chip re-reads without the poll.
    view.rerender(<GitBranchChip {...props} useProjection={() => '/srv/worktree'} />)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('watches its Session only while mounted', () => {
    const { props, acquire, release } = bench({ kind: 'branch', name: 'main', worktree: null, root: null, github: null })
    const { unmount } = render(<GitBranchChip {...props} />)
    expect(acquire).toHaveBeenCalledWith(SESSION)
    expect(release).not.toHaveBeenCalled()
    unmount()
    expect(release).toHaveBeenCalledWith(SESSION)
  })

  it('follows the published answer on the next render', () => {
    const { branches, props } = bench(undefined)
    const { rerender } = render(<GitBranchChip {...props} />)
    expect(screen.queryByRole('button')).toBeNull()
    branches.set({ [SESSION]: { kind: 'branch', name: 'topic', worktree: null, root: null, github: null } })
    rerender(<GitBranchChip {...props} />)
    expect(screen.getByRole('button', { name: '分支 topic' }).textContent).toBe('topic')
  })
})
