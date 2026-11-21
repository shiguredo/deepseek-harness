/**
 * Models page provider sign-in, browser half: the provider-card section that
 * lists the Host's authorization flows and drives one attempt over the
 * `modelSignIn` Remote.
 *
 * The section renders only where a card's route has a flow, so a composition
 * without an account sign-in shows nothing. The Host owns the flow, the
 * credential record, and the paste step's validation; this side only asks.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the Models page's SlotMap merge (the provider-card seat).
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
// Type-only: the ctx.remote merge that carries the `modelSignIn` namespace.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { SignInSection } from './SignInSection.tsx'
import { PlanUsage } from './PlanUsage.tsx'
import { PlanMenuRow } from './PlanMenuRow.tsx'
import { PlanMark } from './PlanMark.tsx'
import type { ModelSignInFace } from './face.ts'
import { de, en, es, fr, ja, pt, ru, zh, type ModelsSignInLocaleKey } from './locales.ts'

export type { SignInSectionProps } from './SignInSection.tsx'
export type { ModelSignInFace } from './face.ts'
export type { ModelsSignInLocaleKey } from './locales.ts'
export type * from '../types.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Provider sign-in copy on the Models page. */
    'settings.modelsSignIn': ModelsSignInLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.modelsSignIn'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.modelSignIn']

/** Unwrap one Remote answer, so the section handles values and failures uniformly. */
async function settle<T>(answer: Promise<RemoteResult<T>>): Promise<T> {
  const settled = await answer
  if (!settled.ok) throw new Error(settled.error.message)
  return settled.value
}

/**
 * Mount the sign-in dictionaries and the provider-card section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'ui-settings-models-signin: dictionaries',
  )
  const face: ModelSignInFace = {
    list: () => settle(ctx.remote.modelSignIn.list()),
    begin: (key, method) => settle(ctx.remote.modelSignIn.begin(key, method)),
    poll: id => settle(ctx.remote.modelSignIn.poll(id)),
    answer: (id, promptId, value) => settle(ctx.remote.modelSignIn.answer(id, promptId, value)),
    cancel: id => settle(ctx.remote.modelSignIn.cancel(id)),
    signOut: key => settle(ctx.remote.modelSignIn.signOut(key)),
  }
  ctx.effect(
    () => ctx.slots.inject('settings.models.provider-card', () => ctx.slots.register({
      name: 'settings.models.provider-card',
      key: 'llm-pi-ai',
      locale: NS,
      inject: () => face,
    }, SignInSection)),
    'ui-settings-models-signin: provider cards',
  )
  // The row's identity mark: the fact an api-key dot cannot state.
  ctx.effect(
    () => ctx.slots.inject('settings.models.provider-mark', () => ctx.slots.register({
      name: 'settings.models.provider-mark',
      key: 'llm-pi-ai',
      locale: NS,
      inject: () => face,
    }, PlanMark)),
    'ui-settings-models-signin: row marks',
  )
  // The composer line answers a different question than the card does — which
  // plan pays for the model this Session runs on — so it registers separately
  // and disappears with the same plugin.
  ctx.effect(
    () => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock',
      id: 'chatgpt-plan',
      locale: NS,
      inject: () => face,
    }, PlanUsage)),
    'ui-settings-models-signin: composer plan line',
  )
  // The plan row lives in the model menu, where the selected model already has
  // a person's attention and the menu is open by that choice alone.
  ctx.effect(
    () => ctx.slots.inject('conversation.input.model.options', () => ctx.slots.register({
      name: 'conversation.input.model.options',
      id: 'chatgpt-plan',
      locale: NS,
      inject: () => face,
    }, PlanMenuRow)),
    'ui-settings-models-signin: model menu plan row',
  )
}
