/**
 * Shared fixture: a temp root holding real git repositories beside a plain
 * directory, and a context with the local subprocess provider mounted.
 *
 * The real provider and the real git binary, not a mocked `ctx.subprocess`,
 * because the facts under test are git's own: a linked worktree resolves to
 * its own branch, a detached HEAD has no branch name, and a directory outside
 * every repository answers `none`.
 */
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { WorkspaceGit, type Config, type WorkspaceGitScope } from '../src/index.ts'

/** One git invocation for test setup; rejects on a non-zero exit. */
export const git = promisify(execFile)

/** One temp root and the context serving it. */
export interface Harness {
  readonly root: string
  readonly ctx: Context
  readonly service: WorkspaceGit
  scope(workspaceRoot: string): WorkspaceGitScope
  dispose(): Promise<void>
}

/**
 * Create the temp root, mount the local subprocess provider, and construct
 * the service directly with the deployment deadline.
 * @param prefix - temp directory prefix naming the suite.
 * @param timeoutMs - git deadline the service runs under.
 * @returns the harness; dispose it in `afterEach`.
 */
export async function openHarness(prefix: string, timeoutMs = 10_000): Promise<Harness> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  const ctx = new Context()
  ctx.provide('sandboxPolicy', { workspaceRoot: root } as never)
  const fiber = await ctx.plugin(LocalSubprocessRuntime)
  const service = new WorkspaceGit(ctx, { timeoutMs } satisfies Config)
  return {
    root,
    ctx,
    service,
    scope: workspaceRoot => ({ sessionId: SessionId('s-test'), workspaceRoot }),
    dispose: async () => {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    },
  }
}

/** Create a repository one commit deep on branch `topic`. */
export async function repoOnTopic(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await git('git', ['init', dir])
  await git('git', ['-C', dir, 'config', 'user.email', 'test@example.com'])
  await git('git', ['-C', dir, 'config', 'user.name', 'Test'])
  await git('git', ['-C', dir, 'config', 'commit.gpgsign', 'false'])
  await git('git', ['-C', dir, 'commit', '--allow-empty', '-m', 'init'])
  await git('git', ['-C', dir, 'checkout', '-b', 'topic'])
}
