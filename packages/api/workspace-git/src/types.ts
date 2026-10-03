/**
 * Wire types of the `workspaceGit` Remote namespace. Types only: generated
 * Remote clients consume this module without Host runtime code.
 *
 * @module @deepseek-ai/dsh-api-workspace-git/types
 */

/** GitHub repository a checkout's `origin` remote names. */
export interface WorkspaceGitGithub {
  /** `owner/repo`. */
  readonly slug: string
  /** Canonical repository URL (`https://github.com/owner/repo`). */
  readonly url: string
}

/** The repository facts every found checkout carries. */
interface WorkspaceGitRepository {
  /**
   * Base name of the checkout's worktree root (`moqt-js-feature`), naming the
   * directory the Session workspace lives in; null when the repository has no
   * working tree (a bare repository) and when the answer is unavailable.
   */
  readonly worktree: string | null
  /** GitHub repository of the `origin` remote, or null when it is absent or names another host. */
  readonly github: WorkspaceGitGithub | null
}

/**
 * What one Session workspace currently has checked out, as the Host read it
 * from the repository containing the workspace directory.
 */
export type WorkspaceGitStatus =
  | (WorkspaceGitRepository & {
    /** A branch is checked out. */
    readonly kind: 'branch'
    /** The branch's short name (`main`, `feature/x`). */
    readonly name: string
  })
  | (WorkspaceGitRepository & {
    /** HEAD is detached from every branch. */
    readonly kind: 'detached'
    /** Short commit id git reports at HEAD. */
    readonly head: string
  })
  | {
    /** The directory is outside a repository, git is unavailable, or the workspace is gone. */
    readonly kind: 'none'
  }
