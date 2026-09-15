/** The service's checkout answers, read from real repositories on disk. */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { git, openHarness, repoOnTopic, type Harness } from './harness.ts'

const signal = (): AbortSignal => new AbortController().signal

const opened: Harness[] = []

async function harness(prefix: string): Promise<Harness> {
  const fixture = await openHarness(prefix)
  opened.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(opened.map(entry => entry.dispose()))
  opened.length = 0
})

describe('WorkspaceGit.status', () => {
  it('reads the branch and directory name of the repository containing the workspace directory', async () => {
    const fixture = await harness('dsh-workspace-git-branch-')
    const repo = join(fixture.root, 'moqt-js')
    await repoOnTopic(repo)
    const expected = { kind: 'branch', name: 'topic', worktree: 'moqt-js', github: null }
    await expect(fixture.service.status(fixture.scope(repo), signal())).resolves.toEqual(expected)
    // A nested workspace directory belongs to the containing repository.
    const nested = join(repo, 'src')
    await mkdir(nested)
    await expect(fixture.service.status(fixture.scope(nested), signal())).resolves.toEqual(expected)
  })

  it('reads the branch and directory name of a linked worktree', async () => {
    const fixture = await harness('dsh-workspace-git-worktree-')
    const repo = join(fixture.root, 'moqt-js')
    await repoOnTopic(repo)
    const worktree = join(fixture.root, 'moqt-js-feature')
    await git('git', ['-C', repo, 'worktree', 'add', worktree, '-b', 'linked'])
    await expect(fixture.service.status(fixture.scope(worktree), signal())).resolves.toEqual({
      kind: 'branch',
      name: 'linked',
      worktree: 'moqt-js-feature',
      github: null,
    })
  })

  it('reports the short commit id of a detached HEAD', async () => {
    const fixture = await harness('dsh-workspace-git-detached-')
    const repo = join(fixture.root, 'moqt-js')
    await repoOnTopic(repo)
    await git('git', ['-C', repo, 'checkout', '--detach'])
    const { stdout } = await git('git', ['-C', repo, 'rev-parse', '--short', 'HEAD'])
    await expect(fixture.service.status(fixture.scope(repo), signal())).resolves.toEqual({
      kind: 'detached',
      head: stdout.trim(),
      worktree: 'moqt-js',
      github: null,
    })
  })

  it('names the GitHub repository the origin remote addresses', async () => {
    const fixture = await harness('dsh-workspace-git-github-')
    const repo = join(fixture.root, 'moqt-js')
    await repoOnTopic(repo)
    await git('git', ['-C', repo, 'remote', 'add', 'origin', 'git@github.com:shiguredo/moqt-js.git'])
    await expect(fixture.service.status(fixture.scope(repo), signal())).resolves.toEqual({
      kind: 'branch',
      name: 'topic',
      worktree: 'moqt-js',
      github: { slug: 'shiguredo/moqt-js', url: 'https://github.com/shiguredo/moqt-js' },
    })
  })

  it('answers no GitHub repository for an origin on another host', async () => {
    const fixture = await harness('dsh-workspace-git-foreign-')
    const repo = join(fixture.root, 'moqt-js')
    await repoOnTopic(repo)
    await git('git', ['-C', repo, 'remote', 'add', 'origin', 'https://gitlab.com/shiguredo/moqt-js.git'])
    await expect(fixture.service.status(fixture.scope(repo), signal())).resolves.toEqual({
      kind: 'branch',
      name: 'topic',
      worktree: 'moqt-js',
      github: null,
    })
  })

  it('reads an unborn branch, and a bare repository without a worktree name', async () => {
    const fixture = await harness('dsh-workspace-git-unborn-')
    const fresh = join(fixture.root, 'fresh')
    await mkdir(fresh, { recursive: true })
    await git('git', ['init', fresh])
    await git('git', ['-C', fresh, 'checkout', '-b', 'unborn-topic'])
    await expect(fixture.service.status(fixture.scope(fresh), signal())).resolves.toEqual({
      kind: 'branch',
      name: 'unborn-topic',
      worktree: 'fresh',
      github: null,
    })

    const bare = join(fixture.root, 'bare.git')
    await git('git', ['init', '--bare', bare])
    await git('git', ['-C', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'])
    await git('git', ['-C', bare, 'remote', 'add', 'origin', 'https://github.com/shiguredo/bare.git'])
    // No working tree: the ref and the remote are still facts.
    await expect(fixture.service.status(fixture.scope(bare), signal())).resolves.toEqual({
      kind: 'branch',
      name: 'main',
      worktree: null,
      github: { slug: 'shiguredo/bare', url: 'https://github.com/shiguredo/bare' },
    })
  })

  it('answers none outside a repository and for a missing directory', async () => {
    const fixture = await harness('dsh-workspace-git-none-')
    const plain = join(fixture.root, 'plain')
    await mkdir(plain)
    await expect(fixture.service.status(fixture.scope(plain), signal())).resolves.toEqual({ kind: 'none' })
    await expect(fixture.service.status(fixture.scope(join(fixture.root, 'missing')), signal())).resolves.toEqual({
      kind: 'none',
    })
  })
})
