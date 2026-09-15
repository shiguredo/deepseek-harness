/** Host registration for the durable font-family preference and its pre-plugin application. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import { bootFontInjection } from './boot-font.ts'
import { FONT_SETTINGS_NAMESPACE, FontSettingsSchema, type FontSettings } from './font-settings.ts'

/**
 * Register the durable font section when the optional settings service is
 * composed, and answer every index injection collection with the font
 * bootstrap row while a family is stored.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(FONT_SETTINGS_NAMESPACE, FontSettingsSchema)
  })
  ctx.on('webserver/index-inject', (table) => {
    const settings = ctx.get('settings')
    const section = settings?.get(FONT_SETTINGS_NAMESPACE) as FontSettings | undefined
    const row = bootFontInjection(section?.fontFamily)
    if (row !== undefined) table.push(row)
  })
}
