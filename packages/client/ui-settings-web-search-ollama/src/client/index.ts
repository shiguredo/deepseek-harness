/**
 * The Ollama Cloud web provider's settings page, browser half: the switch that
 * selects its search and fetch providers over the `web` namespace, the two
 * endpoints and the default result count over the `web-ollama-api` namespace
 * the provider registers, and the key over the credentials domain. The page
 * registers into the Plugins page's `plugins.shiguredo` slot while the Host
 * serves that namespace, so a deployment without this provider shows no trace
 * of it.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the ctx.configForms Context merge. Cross-plugin collaboration
// goes through the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the Plugins page's SlotMap merge (the 'plugins.shiguredo' entry).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the ctx.remote Context merge and the forwarded-event key face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { OllamaSearchCard } from './OllamaSearchCard.tsx'
import {
  WEB_OLLAMA_NS, WEB_NS, OllamaSearchCardController,
} from './ollama-search-card-controller.ts'
import type { OllamaSearchSettings, WebProviderSelection } from './ollama-search-card-controller.ts'
import { de, en, es, fr, ja, pt, ru, zh, type OllamaSearchSettingsLocaleKey } from './locales.ts'

export type { OllamaSearchCardProps } from './OllamaSearchCard.tsx'
export type {
  OllamaSearchCardFace, OllamaSearchCardScopes, OllamaSearchCardState,
  OllamaSearchSettings, WebProviderSelection,
} from './ollama-search-card-controller.ts'
export type { OllamaSearchSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Ollama Cloud search settings page copy. */
    'settings.webSearchOllama': OllamaSearchSettingsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.webSearchOllama'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.credentials', 'configForms']

/**
 * Mount the Ollama Cloud search settings page while the Host serves its namespace.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }), 'ui-settings-web-search-ollama: dictionaries')
  const card = new OllamaSearchCardController({
    web: ctx.configForms.get<WebProviderSelection>(WEB_NS),
    provider: ctx.configForms.get<OllamaSearchSettings>(WEB_OLLAMA_NS),
  }, ctx)
  ctx.effect(() => () => { card.dispose() }, 'ui-settings-web-search-ollama: form subscription')
  // The credential the page reports is not part of any settings section, so
  // no scope publishes when one is written. This is the only signal that a key
  // written on another surface reached the Host.
  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref) => { card.refreshCredential(ref) }),
    'ui-settings-web-search-ollama: credential invalidations',
  )
  ctx.effect(() => ctx.configForms.whileServed([WEB_OLLAMA_NS], () => ctx.slots.inject('plugins.shiguredo', () => ctx.slots.register({
    name: 'plugins.shiguredo', id: 'web-ollama-api', order: 21, label: () => t('title'), locale: NS, inject: () => card.inject(),
  }, OllamaSearchCard))), 'ui-settings-web-search-ollama: page')
}
