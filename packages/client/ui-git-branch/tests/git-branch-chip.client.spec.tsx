/** Chip presentation: what it folds, when it renders, and its watch lifecycle. */
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceGitGithub, WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'
import { GitBranchChip, gitBranchReading, type GitBranchChipProps } from '../src/client/GitBranchChip.tsx'
import { zh } from '../src/client/locales.ts'

const SESSION = 'session' as SessionId
const t: GitBranchChipProps['t'] = makeTranslate(zh)

const GITHUB: WorkspaceGitGithub = { slug: 'shiguredo/moqt-js', url: 'https://github.com/shiguredo/moqt-js' }

afterEach(() => {
  cleanup()
})

/** One chip over a published checkout record with recorded watch verbs. */
function bench(initial: WorkspaceGitStatus | undefined): {
  branches: ReturnType<typeof createSnapshotStore<Record<SessionId, WorkspaceGitStatus | undefined>>>
  acquire: ReturnType<typeof vi.fn>
  release: ReturnType<typeof vi.fn>
  props: GitBranchChipProps
} {
  const branches = createSnapshotStore<Record<SessionId, WorkspaceGitStatus | undefined>>({ [SESSION]: initial })
  const acquire = vi.fn()
  const release = vi.fn()
  function useGitBranch<R>(select: (state: Record<SessionId, WorkspaceGitStatus | undefined>) => R): R {
    return select(branches.getSnapshot())
  }
  return {
    branches,
    acquire,
    release,
    props: { sessionId: SESSION, useGitBranch, acquire, release, t } as unknown as GitBranchChipProps,
  }
}

describe('gitBranchReading', () => {
  it('qualifies the ref with the GitHub slug and drops an unavailable checkout', () => {
    expect(gitBranchReading({ kind: 'none' })).toBeNull()
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: null, github: null }))
      .toEqual({ ref: 'main', worktree: null, href: null, detached: false })
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: 'moqt-js-feature', github: GITHUB }))
      .toEqual({ ref: 'shiguredo/moqt-js:main', worktree: 'moqt-js-feature', href: GITHUB.url, detached: false })
    expect(gitBranchReading({ kind: 'detached', head: 'abc1234', worktree: null, github: null }))
      .toEqual({ ref: 'abc1234', worktree: null, href: null, detached: true })
  })

  it('omits a worktree directory that only repeats the GitHub repository name', () => {
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: 'moqt-js', github: GITHUB }))
      .toEqual({ ref: 'shiguredo/moqt-js:main', worktree: null, href: GITHUB.url, detached: false })
    // Without a GitHub origin the repository name is unknown, so the directory stays.
    expect(gitBranchReading({ kind: 'branch', name: 'main', worktree: 'moqt-js', github: null }))
      .toEqual({ ref: 'main', worktree: 'moqt-js', href: null, detached: false })
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

  it('renders a plain reading with its worktree directory and no link outside GitHub', () => {
    const { props } = bench({ kind: 'branch', name: 'feature/x', worktree: 'moqt-js-feature', github: null })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('img', { name: '分支 feature/x (工作树 moqt-js-feature)' })
    expect(chip.textContent).toBe('feature/x (moqt-js-feature)')
    expect(chip.getAttribute('title')).toBe('分支 feature/x (工作树 moqt-js-feature)')
    expect(chip.tagName).toBe('SPAN')
  })

  it('links a GitHub reading to its repository', () => {
    const { props } = bench({ kind: 'branch', name: 'main', worktree: 'moqt-js-feature', github: GITHUB })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('link', { name: '分支 shiguredo/moqt-js:main (工作树 moqt-js-feature)' })
    expect(chip.textContent).toBe('shiguredo/moqt-js:main (moqt-js-feature)')
    expect(chip.getAttribute('href')).toBe(GITHUB.url)
    expect(chip.getAttribute('target')).toBe('_blank')
    expect(chip.getAttribute('rel')).toBe('noreferrer')
  })

  it('drops the parenthetical when the worktree directory repeats the repository name', () => {
    const { props } = bench({ kind: 'branch', name: 'main', worktree: 'moqt-js', github: GITHUB })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('link', { name: '分支 shiguredo/moqt-js:main' })
    expect(chip.textContent).toBe('shiguredo/moqt-js:main')
  })

  it('reads a detached HEAD as a commit and omits an unknown worktree directory', () => {
    const { props } = bench({ kind: 'detached', head: 'abc1234', worktree: null, github: GITHUB })
    render(<GitBranchChip {...props} />)
    const chip = screen.getByRole('link', { name: '游离 HEAD shiguredo/moqt-js@abc1234' })
    expect(chip.textContent).toBe('shiguredo/moqt-js@abc1234')
  })

  it('watches its Session only while mounted', () => {
    const { props, acquire, release } = bench({ kind: 'branch', name: 'main', worktree: null, github: null })
    const { unmount } = render(<GitBranchChip {...props} />)
    expect(acquire).toHaveBeenCalledWith(SESSION)
    expect(release).not.toHaveBeenCalled()
    unmount()
    expect(release).toHaveBeenCalledWith(SESSION)
  })

  it('follows the published answer on the next render', () => {
    const { branches, props } = bench(undefined)
    const { rerender } = render(<GitBranchChip {...props} />)
    expect(screen.queryByRole('img')).toBeNull()
    branches.set({ [SESSION]: { kind: 'branch', name: 'topic', worktree: null, github: null } })
    rerender(<GitBranchChip {...props} />)
    expect(screen.getByRole('img', { name: '分支 topic' }).textContent).toBe('topic')
  })
})
