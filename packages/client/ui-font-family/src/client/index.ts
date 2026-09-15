/**
 * Browser half of the font-family setting: applies the durable family — or
 * this plugin's built-in default stacks — to the document body, and registers
 * the General settings Font row that edits it.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge and the settings slot contract.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.configForms Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { FontSettings } from '../font-settings.ts'
import { FONT_FAMILY_FIELD, FONT_SETTINGS_NAMESPACE, normalizeFontFamily } from '../font-settings.ts'
import { applyFontFamily, clearFontFamily } from './paint.ts'
import { FontFamilyRow, type FontFamilyRowInjected } from './FontFamilyRow.tsx'
import { createFontFamilyRowStore } from './settings-store.ts'
import { en, NS, zh, type FontKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The Font settings row's copy. */
    'settings.font': FontKey
  }
}

export type { FontFamilyRowComponentProps, FontFamilyRowInjected } from './FontFamilyRow.tsx'

/**
 * Required services: the configuration-form projection plus slots/locale for
 * the Font row. `ctx.configForms.get(entryId)` reads and writes this plugin's
 * own Host entry over the mirrored settings document.
 */
export const inject = ['slots', 'locale', 'configForms']

/**
 * Client plugin body: apply the durable family to the document and register
 * the Font row into the General section's item slot (the feature owns its
 * settings surface).
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx.configForms.get<FontSettings>(FONT_SETTINGS_NAMESPACE)

  ctx.effect(() => {
    const paint = (): void => {
      // The bootstrap row already carries the durable value; writing the
      // defaults before the first accepted section would flash the wrong font.
      if (host.getSnapshot().status === 'loading') return
      applyFontFamily(host.getSnapshot().value?.fontFamily)
    }
    const unsubscribe = host.subscribe(paint)
    paint()
    return () => {
      unsubscribe()
      clearFontFamily()
    }
  }, 'ui-font-family: body variables')

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-font-family: settings row dictionaries')

  const store = createFontFamilyRowStore()
  let bound: BoundActions<typeof store> | undefined
  const sync = (): void => {
    const snapshot = host.getSnapshot()
    bound?.sync(snapshot.value?.fontFamily ?? '', snapshot.revision ?? -1)
  }
  ctx.effect(() => host.subscribe(sync), 'ui-font-family: settings row store')
  const injected = (actions: BoundActions<typeof store>): FontFamilyRowInjected => {
    bound = actions
    // Re-sync from the getter so no change is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setFontFamily: (value) => {
        const fontFamily = normalizeFontFamily(value)
        if (fontFamily === undefined) void host.unset(FONT_FAMILY_FIELD)
        else void host.set(FONT_FAMILY_FIELD, fontFamily)
      },
    }
  }
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'font-family',
    order: 12,
    store,
    locale: NS,
    inject: injected,
  }, FontFamilyRow))
}
