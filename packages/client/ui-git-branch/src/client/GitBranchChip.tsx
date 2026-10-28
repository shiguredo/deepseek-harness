import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconBranchOutlineRegular,
  useAnchoredPosition,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: loads the 'workingDirectory' projection key for the immediate refresh.
import type {} from '@deepseek-ai/dsh-working-directory/client'
// Type-only: loads the 'conversation.composer.stats.lead' declaration from ui-chat.
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
// Type-only: loads the 'conversation.question.header.lead' declaration from ui-user-questions.
import type {} from '@deepseek-ai/dsh-client-ui-user-questions/client'
import { NS } from './locales.ts'
import css from './GitBranchChip.module.css'

/** Hooks and lifecycle verbs injected into the composer stats-row git-branch chip. */
export interface GitBranchChipInjected {
  hooks: {
    gitBranch: ObservableSnapshot<Readonly<Record<SessionId, WorkspaceGitStatus | undefined>>>
  }
  /** Start watching this Session's checkout while its chip is mounted. */
  acquire: (sessionId: SessionId) => void
  /** Stop watching this Session's checkout when its chip unmounts. */
  release: (sessionId: SessionId) => void
  /** Re-read this Session's checkout immediately after its working directory changed. */
  refresh: (sessionId: SessionId) => void
}

/** Full props for the composer stats-row git-branch chip. */
export type GitBranchChipProps =
  PropsRuntime<'conversation.composer.stats.lead'>
  & PropsLocale<typeof NS>
  & InjectFace<GitBranchChipInjected>

/** Display parts of one checkout answer. */
export interface GitBranchReading {
  /** `owner/repo:branch`, `owner/repo@commit`, `branch`, or `commit`. */
  readonly ref: string
  /** The branch name, or the short commit id when HEAD is detached. */
  readonly name: string
  /** GitHub repository URL, or null when the origin is not a GitHub remote. */
  readonly repositoryUrl: string | null
  /**
   * Worktree directory name, or null when the repository has no working tree
   * (a bare repository).
   */
  readonly worktree: string | null
  /** Absolute worktree root path to show, or null when the repository has no working tree. */
  readonly root: string | null
  /** True when the ref is the detached short commit id rather than a branch. */
  readonly detached: boolean
}

/**
 * Fold one checkout answer into the chip's display parts. A GitHub origin
 * qualifies the ref with its `owner/repo`; the resolved worktree root supplies
 * the directory path, and its base name names the worktree.
 * @param status - one `workspaceGit.status` answer.
 * @returns the display parts, or null when there is nothing to show.
 */
export function gitBranchReading(status: WorkspaceGitStatus): GitBranchReading | null {
  if (status.kind === 'none') return null
  const slug = status.github === null ? '' : status.github.slug
  const name = status.kind === 'branch' ? status.name : status.head
  const separator = status.kind === 'branch' ? ':' : '@'
  return {
    ref: slug === '' ? name : `${slug}${separator}${name}`,
    name,
    repositoryUrl: status.github === null ? null : status.github.url,
    worktree: status.worktree,
    root: status.root,
    detached: status.kind === 'detached',
  }
}

/** Unplaced portal panel: hidden but laid out so the placement clamp measures real dimensions. */
const MEASURE_STYLE = { visibility: 'hidden', left: 0, top: 0 } as const

/**
 * Ambient chip leading the composer's session-stats block's first row and the
 * question card's header, naming the checkout the Session workspace lives in:
 * the GitHub repository and branch (`owner/repo:branch`), or the short commit
 * id when HEAD is detached (`owner/repo@abc1234`), followed by the worktree
 * directory name and the absolute worktree root path. Clicking opens a
 * trigger-anchored dialog with the same facts one per row. Nothing is rendered
 * outside a repository, before the first answer, or when the read failed — the
 * chip never reports a guess.
 * @param props - Session runtime, injected checkout state, and localized copy.
 * @returns the chip, or null when there is no checkout to show.
 */
export function GitBranchChip(props: GitBranchChipProps): React.JSX.Element | null {
  const { sessionId, useGitBranch, useProjection, acquire, release, refresh, t } = props
  const status = useGitBranch(state => state[sessionId])
  const workingDirectory = useProjection('workingDirectory')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const pos = useAnchoredPosition({ open, anchorRef: rootRef, panelRef, side: 'top', gap: 8, margin: 12 })
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
  useEffect(() => {
    acquire(sessionId)
    return () => { release(sessionId) }
  }, [acquire, release, sessionId])
  // A working-directory change (a worktree tool entering a linked checkout) can
  // land mid-turn; re-read at once instead of waiting for the 15-second poll.
  useEffect(() => { refresh(sessionId) }, [workingDirectory, refresh, sessionId])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])
  if (status === undefined) return null
  const reading = gitBranchReading(status)
  if (reading === null) return null
  const refLabel = reading.detached
    ? t('detached.tooltip', { ref: reading.ref })
    : t('branch.tooltip', { ref: reading.ref })
  const labelParts = [refLabel]
  if (reading.worktree !== null) labelParts.push(t('worktree.tooltip', { name: reading.worktree }))
  if (reading.root !== null) labelParts.push(t('path.tooltip', { path: reading.root }))
  const label = labelParts.join(' ')
  const textParts = [reading.worktree === null ? reading.ref : `${reading.ref} (${reading.worktree})`]
  if (reading.root !== null) textParts.push(reading.root)
  const text = textParts.join(' · ')
  return (
    <>
      <button
        ref={rootRef}
        type="button"
        className={css.chip}
        data-composer-git-branch
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => { setOpen(!open) }}
      >
        <IconBranchOutlineRegular />
        <span className={css.label}>{text}</span>
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className={css.panel}
          role="dialog"
          aria-label={t('dialog.title')}
          style={pos ?? MEASURE_STYLE}
        >
          <div className={css.title}>
            <span className={css.titleLabel}>
              <IconBranchOutlineRegular />
              {t('dialog.title')}
            </span>
            <span className={css.titleValue}>{reading.name}</span>
          </div>
          <div className={css.titleRule} aria-hidden />
          <dl className={css.details}>
            <dt>{t(reading.detached ? 'dialog.commit' : 'dialog.branch')}</dt>
            <dd>{reading.name}</dd>
            {reading.worktree !== null && (
              <>
                <dt>{t('dialog.worktree')}</dt>
                <dd>{reading.worktree}</dd>
              </>
            )}
            {reading.root !== null && (
              <>
                <dt>{t('dialog.path')}</dt>
                <dd className={css.path}>{reading.root}</dd>
              </>
            )}
            <dt>{t('dialog.repository')}</dt>
            <dd className={css.path}>{reading.repositoryUrl ?? t('dialog.none')}</dd>
          </dl>
        </div>,
        document.body,
      )}
    </>
  )
}
