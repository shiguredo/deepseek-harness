/**
 * Workspace git service: the checkout the session workspace directory lives
 * in, exposed as the `workspaceGit` Remote namespace.
 *
 * The answer is ambient environment information, not session state: nothing
 * here writes a session event or reaches a model request. Git itself resolves
 * worktrees, submodules, and detached HEAD, so the service maps `git` answers
 * onto the wire union.
 */

import { basename } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { SubprocessOutcome } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-working-directory'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Remote, TypertRemoteService, type TypertLookup } from '@deepseek-ai/dsh-typert-protocol'
import { githubRepository } from './github.ts'
import type { WorkspaceGitGithub, WorkspaceGitStatus } from './types.ts'

export type * from './types.ts'

/** A rev-parse answer is one ref name; this bounds a hostile or damaged repository. */
const OUTPUT_CAP_BYTES = 64 * 1024

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `workspaceGit` Remote namespace. */
    workspaceGit: WorkspaceGit
  }
}

/** Session-derived git resolution context for one Session identity. */
export interface WorkspaceGitScope {
  /** Session identity received on the wire. */
  readonly sessionId: SessionId
  /** Effective working directory whose containing repository the checkout facts are read from. */
  readonly workspaceRoot: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertLookupMap {
    /** Resolve a Session id to its effective working directory without loading its event body or activating an Agent. */
    workspaceGitScope: TypertLookup<WorkspaceGitScope, SessionId>
  }
}

/** Deployment bounds on one git invocation. */
export interface Config {
  /** Deadline in milliseconds for one `git` invocation. */
  readonly timeoutMs: number
}

/** Host reader of the checkout one Session workspace lives in. */
export class WorkspaceGit extends TypertRemoteService {
  static inject = ['sandboxPolicy', 'sessions', 'subprocess', 'typert']

  static Config: z<Config> = z.object({
    timeoutMs: z.number().step(1).min(1).max(600_000).required(),
  })

  /**
   * @param ctx - Host context carrying the session store and process capability.
   * @param config - deployment deadline for one git invocation.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'workspaceGit')
    /* jscpd:ignore-start -- deliberate mirror of dsh-api-workspace-files' scope lookup (Agent Note: web-composer-git-branch-chip). */
    ctx.inject(['sessions', 'typert'], (scope) => {
      scope.typert.lookups.register('workspaceGitScope', {
        parameter: 'workspaceGitScope',
        wire: 'workspaceGitScopeId',
        hostTypeSymbol: '@deepseek-ai/dsh-api-workspace-git#WorkspaceGitScope',
        wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
        resolve: async (sessionId) => {
          const live = scope.sessions.get(sessionId)
          const stored = live === undefined
            ? await scope.get('sessionPersistence')?.stat(sessionId)
            : undefined
          const header = live?.header ?? stored?.header
          if (header === undefined) return undefined
          // The Session may have moved since its header was written — the
          // worktree tool enters a linked checkout — so the committed working
          // directory wins over the header, and only a cold Session, whose
          // events are not loaded, falls back to the header.
          const current = live === undefined
            ? undefined
            : scope.get('workingDirectory')?.get(live)
          return {
            sessionId,
            workspaceRoot: current ?? header.cwd ?? scope.sandboxPolicy.workspaceRoot,
          }
        },
      })
    })
    /* jscpd:ignore-end */
  }

  /**
   * Read the checkout one Session workspace lives in.
   * @param workspaceGitScope - resolved working directory for the Session identity on the wire.
   * @param signal - caller cancellation.
   * @returns the checked-out branch or detached short commit id, together with the checkout
   * root path and, when the workspace is a linked worktree, its directory name, plus the
   * GitHub repository the checkout carries, or `none` outside a repository.
   */
  @Remote
  async status(workspaceGitScope: WorkspaceGitScope, signal: AbortSignal): Promise<WorkspaceGitStatus> {
    // `branch --show-current` prints nothing on a detached HEAD, names an
    // unborn branch before its first commit, and fails outside a repository:
    // one read separates all three answers.
    const name = await this.runGit(workspaceGitScope, ['branch', '--show-current'], signal)
    if (name === null) return { kind: 'none' }
    // The worktree and the remote are independent of the ref answer: a
    // detached HEAD still names its directory, and a bare repository still
    // names its remote.
    const [worktree, github] = await Promise.all([
      this.worktreeFacts(workspaceGitScope, signal),
      this.github(workspaceGitScope, signal),
    ])
    const facts = { root: worktree?.root ?? null, worktree: worktree?.worktree ?? null, github }
    if (name !== '') return { kind: 'branch', name, ...facts }
    const head = await this.runGit(workspaceGitScope, ['rev-parse', '--short', 'HEAD'], signal)
    if (head === null || head === '') return { kind: 'none' }
    return { kind: 'detached', head, ...facts }
  }

  /**
   * Absolute path of the checkout root and, when it is a *linked* worktree,
   * its directory name. The main worktree's own `.git` directory is also the
   * common directory; a linked worktree keeps a private git directory under
   * `worktrees/`, so comparing the two tells them apart without reading the
   * worktree list.
   * @param workspaceGitScope - workspace directory the command runs against.
   * @param signal - caller cancellation.
   * @returns the root path and the linked worktree name (null for the main
   * worktree), or null when the repository has no working tree or the read
   * failed.
   */
  private async worktreeFacts(
    workspaceGitScope: WorkspaceGitScope,
    signal: AbortSignal,
  ): Promise<{ root: string; worktree: string | null } | null> {
    const answer = await this.runGit(
      workspaceGitScope,
      ['rev-parse', '--show-toplevel', '--absolute-git-dir', '--path-format=absolute', '--git-common-dir'],
      signal,
    )
    if (answer === null) return null
    const [root, gitDir, commonDir] = answer.split('\n')
    if (root === undefined || gitDir === undefined || commonDir === undefined) return null
    const name = basename(root)
    if (name === '') return null
    return { root, worktree: gitDir === commonDir ? null : name }
  }

  /**
   * GitHub repository the `origin` remote names.
   * @param workspaceGitScope - workspace directory the command runs against.
   * @param signal - caller cancellation.
   * @returns the repository, or null when the remote is absent, unreadable, or addresses another host.
   */
  private async github(workspaceGitScope: WorkspaceGitScope, signal: AbortSignal): Promise<WorkspaceGitGithub | null> {
    const url = await this.runGit(workspaceGitScope, ['config', '--get', 'remote.origin.url'], signal)
    if (url === null || url === '') return null
    return githubRepository(url)
  }

  /**
   * Run one `git -C <workspaceRoot> <argv>` under the deployment deadline and
   * return its trimmed stdout.
   * @param workspaceGitScope - workspace directory the command runs against.
   * @param argv - git arguments including the subcommand.
   * @param signal - caller cancellation, combined with the deployment deadline.
   * @returns stdout on a zero exit, otherwise null.
   */
  private async runGit(
    workspaceGitScope: WorkspaceGitScope,
    argv: readonly string[],
    signal: AbortSignal,
  ): Promise<string | null> {
    const executable = await this.gitPath()
    if (executable === null) return null
    const handle = this.ctx.subprocess.spawn({
      argv: [executable, '-C', workspaceGitScope.workspaceRoot, ...argv],
      cwd: workspaceGitScope.workspaceRoot,
      stdio: {
        stdin: 'ignore',
        stdout: { maxBytes: OUTPUT_CAP_BYTES },
        stderr: { maxBytes: OUTPUT_CAP_BYTES },
      },
      graceMs: this.config.timeoutMs,
      signal: AbortSignal.any([signal, AbortSignal.timeout(this.config.timeoutMs)]),
    })
    let outcome: SubprocessOutcome
    try {
      outcome = await handle.done
    } catch {
      // Swallows spawn, provider, and deadline failures: without exit facts there is no checkout answer.
      return null
    }
    if (outcome.exitCode !== 0) return null
    return handle.collected.stdout?.readFrom(0).text.trim() ?? null
  }

  /**
   * Resolve the git executable through the composition's subprocess provider.
   * @returns the resolved path, or null when the host has no git at all.
   */
  private async gitPath(): Promise<string | null> {
    try {
      return await this.ctx.subprocess.resolveExecutable('git')
    } catch {
      // Swallows the PATH resolver's not-found rejection: a host without git has no checkout facts.
      return null
    }
  }
}

export default WorkspaceGit
