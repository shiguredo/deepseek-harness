import { useEffect } from 'react'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceGitStatus } from '@deepseek-ai/dsh-api-workspace-git/types'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
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
  /**
   * Worktree directory to show, or null when the repository has no working
   * tree or the directory repeats the GitHub repository name.
   */
  readonly worktree: string | null
  /** GitHub repository URL to open, or null when the origin is not a GitHub remote. */
  readonly href: string | null
  /** True when the ref is the detached short commit id rather than a branch. */
  readonly detached: boolean
}

/**
 * Fold one checkout answer into the chip's display parts. A GitHub origin
 * qualifies the ref with its `owner/repo` and supplies the link target; a
 * resolved worktree root names the directory this Session works in, unless
 * that directory repeats the GitHub repository's own name, where the
 * parenthetical would only repeat the ref.
 * @param status - one `workspaceGit.status` answer.
 * @returns the display parts, or null when there is nothing to show.
 */
export function gitBranchReading(status: WorkspaceGitStatus): GitBranchReading | null {
  if (status.kind === 'none') return null
  const slug = status.github === null ? '' : status.github.slug
  const name = status.kind === 'branch' ? status.name : status.head
  const separator = status.kind === 'branch' ? ':' : '@'
  const repository = slug.slice(slug.lastIndexOf('/') + 1)
  return {
    ref: slug === '' ? name : `${slug}${separator}${name}`,
    worktree: status.worktree === repository ? null : status.worktree,
    href: status.github === null ? null : status.github.url,
    detached: status.kind === 'detached',
  }
}

/**
 * Ambient chip leading the composer's session-stats row and the question
 * card's header, naming the checkout the Session workspace lives in: the
 * GitHub repository and branch (`owner/repo:branch`), or the short commit id
 * when HEAD is detached (`owner/repo@abc1234`), followed by the worktree
 * directory that holds it unless that directory repeats the repository name. A
 * GitHub origin makes the whole chip a link to that repository. Nothing is
 * rendered outside a repository, before the first answer, or when the read
 * failed — the chip never reports a guess.
 * @param props - Session runtime, injected checkout state, and localized copy.
 * @returns the chip, or null when there is no checkout to show.
 */
export function GitBranchChip(props: GitBranchChipProps): React.JSX.Element | null {
  const { sessionId, useGitBranch, acquire, release, t } = props
  const status = useGitBranch(state => state[sessionId])
  useEffect(() => {
    acquire(sessionId)
    return () => { release(sessionId) }
  }, [acquire, release, sessionId])
  if (status === undefined) return null
  const reading = gitBranchReading(status)
  if (reading === null) return null
  const refLabel = reading.detached
    ? t('detached.tooltip', { ref: reading.ref })
    : t('branch.tooltip', { ref: reading.ref })
  const label = reading.worktree === null
    ? refLabel
    : `${refLabel} ${t('worktree.tooltip', { name: reading.worktree })}`
  const text = reading.worktree === null ? reading.ref : `${reading.ref} (${reading.worktree})`
  const content = (
    <>
      <IconBranchOutlineRegular />
      <span className={css.label}>{text}</span>
    </>
  )
  if (reading.href === null) {
    return (
      <span className={css.chip} data-composer-git-branch role="img" aria-label={label} title={label}>
        {content}
      </span>
    )
  }
  return (
    <a
      className={css.chip}
      data-composer-git-branch
      href={reading.href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
    >
      {content}
    </a>
  )
}
