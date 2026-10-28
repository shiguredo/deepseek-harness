/**
 * Git push guard plugin, browser half: the composer chip that switches one
 * Session's guard setting over the Host package's same-origin
 * `/push-guard/state` route. The Host owns persistence, enforcement, and the
 * confirmation question; the guard default for new Sessions is the Host
 * plugin's `defaultEnabled` configuration, so this built-in package ships no
 * sidebar entry and no settings page.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the conversation-owned composer-left declaration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session standard-props merge (sessionId).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the Plugins page's 'plugins.shiguredo' declaration.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { GuardChip } from './Chip.tsx'
import { GuardSettingsCard } from './SettingsCard.tsx'
import { de, en, es, fr, ja, NS, pt, ru, zh, type GitPushGuardKey } from './locales.ts'
import { loadState, saveState, type GuardApi } from './state.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Git push guard composer chip copy. */
    'gitPushGuard': GitPushGuardKey
  }
}

/** Composer chip id; the chip sits in the composer tool row of every Session. */
const CHIP_ID = 'git-push-guard'

/** Shiguredo built-in plugin settings id; the card carries the default for new Sessions. */
const SETTINGS_ID = 'git-push-guard'

/** Services required for the chip contribution and the copy registration. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the composer chip for one
 * Session's guard setting.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'ui-git-push-guard: dictionaries',
  )
  const t = ctx.locale.bind(NS)
  // One stable face: the component's mount effect depends on these callback
  // identities, and a fresh object per render would re-fetch.
  const api: GuardApi = { loadState, saveState }

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: CHIP_ID,
    order: 40,
    locale: NS,
    inject: () => api,
  }, GuardChip))

  // Shiguredo built-in plugin settings: the default for new Sessions, in the
  // group after Experimental instead of a sidebar page.
  ctx.slots.inject('plugins.shiguredo', () => ctx.slots.register({
    name: 'plugins.shiguredo',
    id: SETTINGS_ID,
    order: 60,
    label: () => t('settingsTitle'),
    locale: NS,
    inject: () => api,
  }, GuardSettingsCard))
}
