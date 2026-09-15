/**
 * Browser-half lifecycle over the real SlotRegistry: the dictionary and both
 * chip seat registrations with fiber teardown proving removal (HMR safety),
 * and the injected controller face.
 */
// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { apply, inject, type GitBranchChipInjected } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { GitBranchChip } from '../src/client/GitBranchChip.tsx'
import { en, NS, zh } from '../src/client/locales.ts'

const SESSION = 'session' as SessionId

afterEach(() => {
  vi.restoreAllMocks()
})

/** Boot the browser half over a real slot tree declaring the stats row's lead seat. */
async function bench(): Promise<{ ctx: Context; fiber: ReturnType<Context['plugin']>; status: ReturnType<typeof vi.fn> }> {
  const status = vi.fn(async () => ({
    ok: true as const,
    value: { kind: 'branch' as const, name: 'main', worktree: 'moqt-js', github: null },
  }))
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.composer.dock': { kind: 'list', scope: 'session' },
      'conversation.question.header.lead': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  // The stats row owns one seat; the root stands in for the question card's declaration.
  ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'stats',
    children: {
      'conversation.composer.stats.lead': { kind: 'list', scope: 'session' },
    },
  } as never, () => null)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const remote = { workspaceGit: { status } }
  ctx.provide('remote', remote as never)
  ctx.provide('remote.workspaceGit', remote.workspaceGit as never)
  const fiber = ctx.plugin({ inject: [...inject], apply })
  await fiber.await()
  return { ctx, fiber, status }
}

function seatEntryIds(ctx: Context): (string | undefined)[] {
  return ctx.slots.entries('conversation.composer.stats.lead').map(entry => entry.options.id)
}

describe('ui-git-branch browser half', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.workspaceGit'])
  })

  it('registers one chip in each lead seat, and fiber teardown removes both (HMR safety)', async () => {
    const { ctx, fiber } = await bench()
    const stats = ctx.slots.entries('conversation.composer.stats.lead')[0]
    expect(stats?.component).toBe(GitBranchChip)
    expect(stats?.options).toMatchObject({ id: 'git-branch', order: 0 })
    const header = ctx.slots.entries('conversation.question.header.lead')[0]
    expect(header?.component).toBe(GitBranchChip)
    expect(header?.options).toMatchObject({ id: 'git-branch', order: 0 })
    await fiber.dispose()
    expect(seatEntryIds(ctx)).not.toContain('git-branch')
    expect(ctx.slots.entries('conversation.question.header.lead')).toHaveLength(0)
  })

  it('injects the checkout snapshot and the acquire/release verbs', async () => {
    const { ctx, fiber, status } = await bench()
    const entry = ctx.slots.entries('conversation.composer.stats.lead')[0]
    const injected = (entry!.inject as () => Pick<GitBranchChipInjected, keyof GitBranchChipInjected>)()
    injected.acquire(SESSION)
    await vi.waitFor(() => {
      expect(injected.hooks.gitBranch.getSnapshot()[SESSION]).toEqual({
        kind: 'branch',
        name: 'main',
        worktree: 'moqt-js',
        github: null,
      })
    })
    expect(status).toHaveBeenCalledWith(SESSION, expect.any(AbortSignal))
    injected.release(SESSION)
    expect(injected.hooks.gitBranch.getSnapshot()[SESSION]).toBeUndefined()
    await fiber.dispose()
  })

  it('registers both dictionaries under its own namespace and releases them with the fiber', async () => {
    const { ctx, fiber } = await bench()
    ctx.locale.setLocale('zh')
    const translate = ctx.locale.bind(NS)
    expect(translate('branch.tooltip', { ref: 'main' })).toBe(zh['branch.tooltip'].replace('{ref}', 'main'))
    ctx.locale.setLocale('en')
    expect(translate('branch.tooltip', { ref: 'main' })).toBe(en['branch.tooltip'].replace('{ref}', 'main'))
    await fiber.dispose()
    expect(translate('branch.tooltip', { ref: 'main' })).not.toBe(en['branch.tooltip'].replace('{ref}', 'main'))
  })

  it('keeps the English dictionary key-identical to the Chinese source of truth', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })
})

describe('ui-git-branch node half', () => {
  it('the node apply is an inert loader seat', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
