/** Controller polling, visibility, settling, and lifecycle behavior. */
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@deepseek-ai/dsh-client-test-runtime'
import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { WorkspaceGitGithub, WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { GIT_BRANCH_POLL_MS, GitBranchController } from '../src/client/controller.ts'

const SESSION = 'session' as SessionId
const OTHER = 'other' as SessionId

const GITHUB: WorkspaceGitGithub = { slug: 'shiguredo/moqt-js', url: 'https://github.com/shiguredo/moqt-js' }

/** The default answer: a branch with no GitHub origin and no named worktree. */
const BRANCH: WorkspaceGitStatus = { kind: 'branch', name: 'main', worktree: null, github: null }

type StatusAnswer = RemoteResult<WorkspaceGitStatus>
type StatusCall = (sessionId: SessionId, signal: AbortSignal | undefined) => Promise<StatusAnswer>

let visibility: 'visible' | 'hidden'

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** One settled controller over a recorded checkout call. */
function bench(status: StatusCall = async () => ({ ok: true, value: BRANCH })): {
  controller: GitBranchController
  calls: SessionId[]
  signals: (AbortSignal | undefined)[]
} {
  const calls: SessionId[] = []
  const signals: (AbortSignal | undefined)[] = []
  const controller = new GitBranchController({
    workspaceGit: {
      status: (sessionId, signal) => {
        calls.push(sessionId)
        signals.push(signal)
        return status(sessionId, signal)
      },
    },
  })
  return { controller, calls, signals }
}

/** Let one settled promise's continuation run. */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('GitBranchController watches', () => {
  it('publishes the first answer, drops it on the last release, and ignores unknown releases', async () => {
    const { controller, calls } = bench()
    controller.release(OTHER)
    controller.acquire(SESSION)
    controller.acquire(SESSION)
    await settle()
    expect(calls).toEqual([SESSION])
    expect(controller.branches.getSnapshot()[SESSION]).toEqual(BRANCH)
    // Two mounted chips share one read and one answer; only the last release drops it.
    controller.release(SESSION)
    expect(controller.branches.getSnapshot()[SESSION]).toEqual(BRANCH)
    controller.release(SESSION)
    expect(controller.branches.getSnapshot()[SESSION]).toBeUndefined()
    controller.dispose()
  })

  it('keeps one Session watched until its last mounted chip releases it', async () => {
    const { controller, calls } = bench()
    controller.acquire(SESSION)
    controller.acquire(SESSION)
    await settle()
    controller.release(SESSION)
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls).toEqual([SESSION, SESSION])

    controller.release(SESSION)
    const stopped = calls.length
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls.slice(stopped)).toEqual([])
    controller.dispose()
  })

  it('polls on the interval only while the page is visible and refreshes when it returns', async () => {
    const { controller, calls } = bench()
    controller.acquire(SESSION)
    await settle()
    expect(calls).toEqual([SESSION])

    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls).toEqual([SESSION])

    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(calls).toEqual([SESSION, SESSION])

    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls).toEqual([SESSION, SESSION, SESSION])
    controller.dispose()
  })

  it('watches several Sessions over one clock and one visibility listener', async () => {
    const { controller, calls } = bench()
    controller.acquire(SESSION)
    controller.acquire(OTHER)
    await settle()
    expect(calls).toEqual([SESSION, OTHER])
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(calls).toEqual([SESSION, OTHER, SESSION, OTHER])

    controller.release(SESSION)
    const before = calls.length
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls.slice(before)).toEqual([OTHER])

    controller.release(OTHER)
    const stopped = calls.length
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(calls.slice(stopped)).toEqual([])
    controller.dispose()
  })

  it('skips a poll while a read is in flight', async () => {
    let answer!: (result: StatusAnswer) => void
    const { controller, calls } = bench(() => new Promise<StatusAnswer>((resolve) => { answer = resolve }))
    controller.acquire(SESSION)
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS * 3)
    expect(calls).toHaveLength(1)
    answer({ ok: true, value: { kind: 'none' } })
    await settle()
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    expect(calls).toHaveLength(2)
    controller.dispose()
  })
})

describe('GitBranchController publishing', () => {
  it('publishes only reads that differ from the last answer', async () => {
    const answers: WorkspaceGitStatus[] = [
      { kind: 'branch', name: 'main', worktree: 'moqt-js', github: GITHUB },
      { kind: 'branch', name: 'main', worktree: 'moqt-js', github: GITHUB },
      { kind: 'branch', name: 'main', worktree: 'moqt-js-2', github: GITHUB },
      { kind: 'branch', name: 'main', worktree: 'moqt-js-2', github: { ...GITHUB, url: 'https://github.com/elsewhere' } },
      { kind: 'branch', name: 'main', worktree: 'moqt-js-2', github: { slug: 'elsewhere/moqt-js', url: 'https://github.com/elsewhere/moqt-js' } },
      { kind: 'branch', name: 'topic', worktree: null, github: null },
      { kind: 'detached', head: 'abc1234', worktree: null, github: null },
      { kind: 'detached', head: 'abc1234', worktree: null, github: null },
      { kind: 'none' },
      { kind: 'none' },
    ]
    const { controller } = bench(async () => ({ ok: true, value: answers.shift() ?? { kind: 'none' } }))
    let updates = 0
    controller.branches.subscribe(() => { updates += 1 })
    controller.acquire(SESSION)
    await settle()
    for (let poll = 1; poll < 10; poll += 1) {
      vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
      await settle()
    }
    expect(updates).toBe(7)
    expect(controller.branches.getSnapshot()[SESSION]).toEqual({ kind: 'none' })
    controller.dispose()
  })

  it('keeps the last answer through a failed read', async () => {
    let answer: StatusAnswer = { ok: true, value: BRANCH }
    const { controller } = bench(async () => answer)
    controller.acquire(SESSION)
    await settle()
    answer = { ok: false, error: new RemoteError('gateway/internal', 'down', {}) }
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS)
    await settle()
    expect(controller.branches.getSnapshot()[SESSION]).toEqual(BRANCH)
    controller.dispose()
  })

  it('publishes nothing for a rejected call and for a read that settled after release', async () => {
    const rejects = bench(async () => { throw new Error('down') })
    rejects.controller.acquire(SESSION)
    await settle()
    expect(rejects.controller.branches.getSnapshot()[SESSION]).toBeUndefined()
    rejects.controller.dispose()

    let answer!: (result: StatusAnswer) => void
    const released = bench(() => new Promise<StatusAnswer>((resolve) => { answer = resolve }))
    released.controller.acquire(SESSION)
    released.controller.release(SESSION)
    answer({ ok: true, value: BRANCH })
    await settle()
    expect(released.controller.branches.getSnapshot()[SESSION]).toBeUndefined()
    released.controller.dispose()
  })

  it('drops a late settlement from a re-acquired Session', async () => {
    const answers: ((result: StatusAnswer) => void)[] = []
    const { controller, calls } = bench(() => new Promise<StatusAnswer>((resolve) => { answers.push(resolve) }))
    controller.acquire(SESSION)
    controller.release(SESSION)
    controller.acquire(SESSION)
    expect(calls).toHaveLength(2)
    answers[0]?.({ ok: true, value: { kind: 'branch', name: 'stale', worktree: null, github: null } })
    answers[1]?.({ ok: true, value: { kind: 'branch', name: 'fresh', worktree: null, github: null } })
    await settle()
    expect(controller.branches.getSnapshot()[SESSION]).toEqual({ kind: 'branch', name: 'fresh', worktree: null, github: null })
    controller.dispose()
  })
})

describe('GitBranchController disposal', () => {
  it('aborts in-flight reads and stops the clock', async () => {
    let answer!: (result: StatusAnswer) => void
    const { controller, calls, signals } = bench(() => new Promise<StatusAnswer>((resolve) => { answer = resolve }))
    controller.dispose()
    controller.acquire(SESSION)
    controller.dispose()
    expect(signals[0]?.aborted).toBe(true)
    vi.advanceTimersByTime(GIT_BRANCH_POLL_MS * 2)
    expect(calls).toHaveLength(1)
    answer({ ok: true, value: BRANCH })
    await settle()
    expect(controller.branches.getSnapshot()[SESSION]).toBeUndefined()
  })
})
