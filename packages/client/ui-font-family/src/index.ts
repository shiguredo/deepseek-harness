/** Host registration for the durable font-family preference and its pre-plugin application. */

import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { bootFontInjection } from './boot-font.ts'
import { FONT_FAMILY_FIELD, FontSettingsFields } from './font-settings.ts'

export {
  FONT_FAMILY_FIELD, FONT_FAMILY_MAX_LENGTH, FONT_FAMILY_PATTERN, FONT_FAMILY_VARIABLES,
  FONT_SETTINGS_NAMESPACE, FontSettingsSchema, normalizeFontFamily, type FontSettings,
} from './font-settings.ts'

/** Runtime preference projected to the browser. */
export interface Config {
  /** CSS font-family override; absent keeps the shipped locale-neutral stacks. */
  fontFamily: Volatile<string | undefined>
}

/** Live preference projected to the browser. */
export const Config = z.object({
  fontFamily: FontSettingsFields[FONT_FAMILY_FIELD].volatile(),
})

/**
 * Own the font-family preference through the configuration form projection and
 * answer every index injection collection with the font bootstrap row while a
 * family is stored.
 * @param ctx - Host plugin context.
 * @param config - Validated live font preference.
 */
export function apply(ctx: Context, config: Config): void {
  /* jscpd:ignore-start -- deliberately parallels ui-theme's host half: the same
     optional settings-presentation opt-out and one per-index boot row. */
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  ctx.on('webserver/index-inject', (table) => {
    const row = bootFontInjection(config.fontFamily.get())
    if (row !== undefined) table.push(row)
  })
  /* jscpd:ignore-end */
}
