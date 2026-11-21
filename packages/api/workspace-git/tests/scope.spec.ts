import { resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, type SessionHeader } from '@deepseek-ai/dsh-session'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { describe, expect, it, vi } from 'vitest'
import WorkspaceGit from '../src/index.ts'

const CONFIG = { timeoutMs: 5_000 }

function header(id: SessionId, cwd?: string): SessionHeader {
  return {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt: 1,
    isSeeded: false,
    origin: 'subagent',
    ...cwd === undefined ? {} : { cwd },
  }
}

describe('Workspace Git Session scope lookup', () => {
  it('prefers a live Session projected working directory over its immutable header', async () => {
    const movedId = SessionId('live-moved')
    const plainId = SessionId('live-plain')
    const movedRoot = resolve('moved-workspace')
    const headerRoot = resolve('header-workspace')
    const plainRoot = resolve('plain-workspace')
    const ctx = new Context()
    ctx.provide('sandboxPolicy', { workspaceRoot: movedRoot } as never)
    ctx.provide('subprocess', {} as never)
    // The working-directory projection owns the effective directory; a moved
    // Session answers with it while an unmoved one leaves the header in charge.
    ctx.provide('workingDirectory', {
      get: (session: { header: SessionHeader }) =>
        session.header.id === movedId ? movedRoot : undefined,
    } as never)
    const sessions = await ctx.plugin(SessionStore)
    const typert = await ctx.plugin(TypertRegistry)
    const workspaceGit = await ctx.plugin(WorkspaceGit, CONFIG)

    try {
      ctx.sessions.create(movedId, { meta: { cwd: headerRoot, origin: 'subagent' } })
      ctx.sessions.create(plainId, { meta: { cwd: plainRoot, origin: 'subagent' } })
      const lookup = ctx.typert.lookups.get('workspaceGitScope')
      if (lookup === undefined) throw new Error('workspaceGitScope lookup did not register')

      await expect(lookup.resolve(movedId)).resolves.toEqual({ sessionId: movedId, workspaceRoot: movedRoot })
      await expect(lookup.resolve(plainId)).resolves.toEqual({ sessionId: plainId, workspaceRoot: plainRoot })
    } finally {
      await workspaceGit.dispose()
      await sessions.dispose()
      await typert.dispose()
    }
  })

  it('uses live or stored headers without an Agent and leaves with its plugin', async () => {
    const liveId = SessionId('live-subagent')
    const coldId = SessionId('cold-subagent')
    const fallbackId = SessionId('cold-without-cwd')
    const missingId = SessionId('missing')
    const liveRoot = resolve('live-workspace')
    const coldRoot = resolve('cold-workspace')
    const fallbackRoot = resolve('fallback-workspace')
    const stat = vi.fn(async (id: SessionId) => {
      if (id === coldId) return { header: header(coldId, coldRoot) }
      if (id === fallbackId) return { header: header(fallbackId) }
      return undefined
    })
    const ctx = new Context()
    ctx.provide('sandboxPolicy', { workspaceRoot: fallbackRoot } as never)
    ctx.provide('subprocess', {} as never)
    ctx.provide('sessionPersistence', { stat } as never)
    const sessions = await ctx.plugin(SessionStore)
    const typert = await ctx.plugin(TypertRegistry)
    const workspaceGit = await ctx.plugin(WorkspaceGit, CONFIG)

    try {
      ctx.sessions.create(liveId, { meta: { cwd: liveRoot, origin: 'subagent' } })
      expect(ctx.get('agents')).toBeUndefined()
      const lookup = ctx.typert.lookups.get('workspaceGitScope')
      expect(lookup).toMatchObject({
        parameter: 'workspaceGitScope',
        wire: 'workspaceGitScopeId',
        hostTypeSymbol: '@deepseek-ai/dsh-api-workspace-git#WorkspaceGitScope',
        wireTypeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
      })
      if (lookup === undefined) throw new Error('workspaceGitScope lookup did not register')

      await expect(lookup.resolve(liveId)).resolves.toEqual({ sessionId: liveId, workspaceRoot: liveRoot })
      expect(stat).not.toHaveBeenCalled()
      await expect(lookup.resolve(coldId)).resolves.toEqual({ sessionId: coldId, workspaceRoot: coldRoot })
      await expect(lookup.resolve(fallbackId)).resolves.toEqual({ sessionId: fallbackId, workspaceRoot: fallbackRoot })
      await expect(lookup.resolve(missingId)).resolves.toBeUndefined()
      expect(stat.mock.calls.map(([id]) => id)).toEqual([coldId, fallbackId, missingId])

      await workspaceGit.dispose()
      expect(ctx.typert.lookups.get('workspaceGitScope')).toBeUndefined()
    } finally {
      await workspaceGit.dispose()
      await sessions.dispose()
      await typert.dispose()
    }
  })
})
