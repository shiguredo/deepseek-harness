/**
 * Browser half of the Japanese language pack: registers the `ja` language
 * definition and one Japanese dictionary per shipped namespace over the locale
 * registry the `@deepseek-ai/dsh-client-locale` service owns. Keys a dictionary
 * does not carry fall back through the language's declared `en` chain, so a
 * namespace added upstream surfaces untranslated rather than blank.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { DICTIONARIES } from './dicts/index.ts'

/** Required service: the locale registry this pack contributes to. */
export const inject = ['locale']

/**
 * Client plugin body: register the language definition and every dictionary as
 * owned effects, so unload and HMR remove exactly this pack's contributions.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' }),
    'locale-ja: language definition',
  )
  ctx.effect(() => {
    const disposers = DICTIONARIES.map(({ ns, dict }) => ctx.locale.register(ns, 'ja', dict))
    return () => {
      for (const dispose of disposers.reverse()) dispose()
    }
  }, 'locale-ja: dictionaries')
}
