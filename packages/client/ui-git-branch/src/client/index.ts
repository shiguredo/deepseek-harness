/**
 * Git-branch chip plugin, browser half: the lead occupant of the composer's
 * session-stats row and of the question card's header, showing the checkout
 * the current Session workspace lives in. The Host answers through the
 * `workspaceGit` Remote namespace; this plugin owns the polling cache and the
 * chip presentation.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { GitBranchController } from './controller.ts'
import { GitBranchChip, type GitBranchChipInjected } from './GitBranchChip.tsx'
import { en, NS, zh, type GitBranchKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Composer stats-row git-branch copy. */
    'gitBranch': GitBranchKey
  }
}

export type { GitBranchChipInjected, GitBranchChipProps } from './GitBranchChip.tsx'

/** Required services for the Remote face, the seat contribution, and copy registration. */
export const inject = ['slots', 'locale', 'remote', 'remote.workspaceGit']

/**
 * Client plugin body: register the dictionaries, the checkout controller, and
 * the chip's two seats — the composer's stats row and the question card's
 * header.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const controller = new GitBranchController(ctx.remote)
  ctx.effect(() => () => { controller.dispose() }, 'ui-git-branch: checkout polling')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git-branch: dictionaries')
  const chipInjected = (): GitBranchChipInjected => ({
    hooks: { gitBranch: controller.branches },
    acquire: (sessionId) => { controller.acquire(sessionId) },
    release: (sessionId) => { controller.release(sessionId) },
  })
  // ui-chat's stats row renders this seat ahead of its figures, so the chip
  // reads with the stats it shares the line with.
  ctx.slots.inject('conversation.composer.stats.lead', () => ctx.slots.register({
    name: 'conversation.composer.stats.lead',
    id: 'git-branch',
    order: 0,
    locale: NS,
    inject: chipInjected,
  }, GitBranchChip))
  // The question takeover hides the composer bar, so ui-user-questions'
  // card header carries its own lead seat and the checkout stays visible
  // while the user answers. Both chips share one watch per Session.
  ctx.slots.inject('conversation.question.header.lead', () => ctx.slots.register({
    name: 'conversation.question.header.lead',
    id: 'git-branch',
    order: 0,
    locale: NS,
    inject: chipInjected,
  }, GitBranchChip))
}
