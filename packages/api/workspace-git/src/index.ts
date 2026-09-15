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

/** Header-derived git resolution context for one Session identity. */
export interface WorkspaceGitScope {
  /** Session identity received on the wire. */
  readonly sessionId: SessionId
  /** Workspace directory whose containing repository the checkout facts are read from. */
  readonly workspaceRoot: string
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertLookupMap {
    /** Resolve a Session id to its workspace root without loading its event body or activating an Agent. */
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
          const live = scope.sessions.get(sessionId)?.header
          const stored = live === undefined
            ? await scope.get('sessionPersistence')?.stat(sessionId)
            : undefined
          const header = live ?? stored?.header
          if (header === undefined) return undefined
          return {
            sessionId,
            workspaceRoot: header.cwd ?? scope.sandboxPolicy.workspaceRoot,
          }
        },
      })
    })
    /* jscpd:ignore-end */
  }

  /**
   * Read the checkout one Session workspace lives in.
   * @param workspaceGitScope - header-derived workspace directory for the Session identity on the wire.
   * @param signal - caller cancellation.
   * @returns the checked-out branch or detached short commit id, together with the worktree
   * directory name and GitHub repository the checkout carries, or `none` outside a repository.
   */
  @Remote
  async status(workspaceGitScope: WorkspaceGitScope, signal: AbortSignal): Promise<WorkspaceGitStatus> {
    // `branch --show-current` prints nothing on a detached HEAD, names an
    // unborn branch before its first commit, and fails outside a repository:
    // one read separates all three answers.
    const name = await this.runGit(workspaceGitScope, ['branch', '--show-current'], signal)
    if (name === null) return { kind: 'none' }
    // The worktree name and the remote are independent of the ref answer: a
    // detached HEAD still names its directory, and a bare repository still
    // names its remote.
    const [worktree, github] = await Promise.all([
      this.worktreeName(workspaceGitScope, signal),
      this.github(workspaceGitScope, signal),
    ])
    if (name !== '') return { kind: 'branch', name, worktree, github }
    const head = await this.runGit(workspaceGitScope, ['rev-parse', '--short', 'HEAD'], signal)
    if (head === null || head === '') return { kind: 'none' }
    return { kind: 'detached', head, worktree, github }
  }

  /**
   * Base name of the checkout's worktree root, which names the directory the
   * Session workspace lives in.
   * @param workspaceGitScope - workspace directory the command runs against.
   * @param signal - caller cancellation.
   * @returns the directory name, or null when the repository has no working tree or the read failed.
   */
  private async worktreeName(workspaceGitScope: WorkspaceGitScope, signal: AbortSignal): Promise<string | null> {
    const root = await this.runGit(workspaceGitScope, ['rev-parse', '--show-toplevel'], signal)
    if (root === null) return null
    const name = basename(root)
    return name === '' ? null : name
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
