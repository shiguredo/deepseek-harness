/**
 * Polling carrier for the `workspaceGit` Remote namespace: one snapshot of
 * every watched Session's checkout, refreshed while the page is visible and on
 * becoming visible again. The branch, worktree, or remote can change outside
 * React (a terminal checkout, an agent turn), so the page re-reads on its own.
 */

import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'

/** How often one visible page re-reads every watched checkout. */
export const GIT_BRANCH_POLL_MS = 15_000

/** One watched Session's in-flight bookkeeping; `generation` fences late settlements. */
interface Watched {
  generation: number
  inFlight: boolean
  /** Mounted chips sharing this watch; the last release ends it. */
  count: number
}

/** The slice of the Client Remote face this controller calls. */
export type WorkspaceGitRemote = {
  readonly workspaceGit: Pick<ClientRemote['workspaceGit'], 'status'>
}

/** The displayed fields of one answer, comparable field by field; null outside a repository. */
function displayFields(status: WorkspaceGitStatus): {
  readonly kind: 'branch' | 'detached'
  readonly ref: string
  readonly worktree: string | null
  readonly slug: string | null
  readonly url: string | null
} | null {
  if (status.kind === 'none') return null
  return {
    kind: status.kind,
    ref: status.kind === 'branch' ? status.name : status.head,
    worktree: status.worktree,
    slug: status.github?.slug ?? null,
    url: status.github?.url ?? null,
  }
}

/** Whether two reads name the same checkout, so an unchanged poll publishes nothing. */
function sameStatus(left: WorkspaceGitStatus | undefined, right: WorkspaceGitStatus): boolean {
  if (left === undefined) return false
  const previous = displayFields(left)
  const next = displayFields(right)
  if (previous === null || next === null) return previous === next
  return previous.kind === next.kind
    && previous.ref === next.ref
    && previous.worktree === next.worktree
    && previous.slug === next.slug
    && previous.url === next.url
}

/**
 * Owns the watched Session set, the visible-page poll, and the published
 * snapshot. Components acquire their own Session on mount and release it on
 * unmount; several mounted chips share one watch, and the controller stops
 * polling when the last share leaves.
 */
export class GitBranchController {
  /** Latest read per watched Session; a missing key means no answer yet. */
  readonly branches: SnapshotStore<Record<SessionId, WorkspaceGitStatus | undefined>> = createSnapshotStore({})

  private readonly watched = new Map<SessionId, Watched>()
  private readonly abort = new AbortController()
  private nextGeneration = 0
  private timer: ReturnType<typeof setInterval> | undefined

  /** The page became visible again: every watched checkout re-reads at once. */
  private readonly onVisible = (): void => {
    if (document.visibilityState === 'visible') this.refreshAll()
  }

  /**
   * @param remote - the Client Remote face carrying the `workspaceGit` namespace.
   */
  constructor(private readonly remote: WorkspaceGitRemote) {}

  /**
   * Start watching one Session and read its checkout immediately. A Session
   * another mounted chip already watches only takes a share of that watch.
   * @param sessionId - the Session whose workspace checkout is displayed.
   */
  acquire(sessionId: SessionId): void {
    const watched = this.watched.get(sessionId)
    if (watched !== undefined) {
      watched.count += 1
      return
    }
    const next: Watched = { generation: this.nextGeneration++, inFlight: false, count: 1 }
    this.watched.set(sessionId, next)
    if (this.watched.size === 1) this.start()
    this.refresh(sessionId, next)
  }

  /**
   * Release one chip's share of a Session, dropping its published answer and
   * stopping the clock when the last share leaves.
   * @param sessionId - the Session whose chip is leaving the page.
   */
  release(sessionId: SessionId): void {
    const watched = this.watched.get(sessionId)
    if (watched === undefined) return
    watched.count -= 1
    if (watched.count > 0) return
    this.watched.delete(sessionId)
    this.branches.update((draft) => { draft[sessionId] = undefined })
    if (this.watched.size === 0) this.stop()
  }

  /** Stop polling, cancel in-flight reads, and forget every watched Session. */
  dispose(): void {
    this.stop()
    this.abort.abort()
    this.watched.clear()
  }

  private start(): void {
    this.timer = setInterval(() => { this.tick() }, GIT_BRANCH_POLL_MS)
    document.addEventListener('visibilitychange', this.onVisible)
  }

  private stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
    document.removeEventListener('visibilitychange', this.onVisible)
  }

  /** One poll: a hidden page keeps its last answers and reads nothing. */
  private tick(): void {
    if (document.visibilityState !== 'visible') return
    this.refreshAll()
  }

  private refreshAll(): void {
    for (const [sessionId, watched] of this.watched) this.refresh(sessionId, watched)
  }

  /** One read per watched Session, at most one in flight; repeats are skipped, not queued. */
  private refresh(sessionId: SessionId, watched: Watched): void {
    if (watched.inFlight) return
    watched.inFlight = true
    const generation = watched.generation
    void this.remote.workspaceGit.status(sessionId, this.abort.signal).then(
      (result) => { this.settle(sessionId, generation, result.ok ? result.value : undefined) },
      () => { this.settle(sessionId, generation, undefined) },
    )
  }

  /**
   * Publish one settled read. A failure keeps the last known answer, and a
   * fully released or re-acquired Session drops the settlement entirely.
   */
  private settle(sessionId: SessionId, generation: number, value: WorkspaceGitStatus | undefined): void {
    const watched = this.watched.get(sessionId)
    if (watched === undefined || watched.generation !== generation) return
    watched.inFlight = false
    if (value === undefined) return
    if (sameStatus(this.branches.getSnapshot()[sessionId], value)) return
    this.branches.update((draft) => { draft[sessionId] = value })
  }
}
