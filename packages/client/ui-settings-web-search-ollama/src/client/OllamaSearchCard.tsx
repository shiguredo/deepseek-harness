/**
 * The Ollama Cloud web provider's settings page: whether this deployment uses
 * it, and the result count search applies when a caller names none. The key is
 * the Ollama Cloud model provider's, so the page only reports whether one is
 * configured.
 */

import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { SettingsForm, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { formLabels } from './locales.ts'
import css from './OllamaSearchCard.module.css'
import type { OllamaSearchCardFace } from './ollama-search-card-controller.ts'

/** Props the renderer binds for the Ollama Cloud web page. */
export type OllamaSearchCardProps =
  PropsRuntime<'plugins.shiguredo'>
  & PropsLocale<'settings.webSearchOllama'>
  & InjectFace<OllamaSearchCardFace>

/**
 * Render the Ollama Cloud web provider's one-liner or its settings form, as the Plugins page asks.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export function OllamaSearchCard(props: OllamaSearchCardProps) {
  const { t } = props
  const state = props.useOllamaSearchCard(snapshot => snapshot)
  if (props.view === 'summary') return t('description')
  const disabled = !state.writable
  return (
    <SettingsForm labels={formLabels(t)} state={state} onSave={props.save} onDiscard={props.discard}>
      {state.switchAvailable
        ? (
          <div className={css.feature}>
            <label className={css.toggleRow}>
              <span>{t('useOllama')}</span>
              <Switch
                checked={state.useOllama}
                label={t('useOllama')}
                // Selecting the pair points the Host at providers that register
                // only while the shared key resolves, so the switch cannot turn
                // on first. Turning it off stays available: the key can be gone
                // already.
                disabled={disabled || (!state.apiKeyConfigured && !state.useOllama)}
                onChange={(checked) => { props.setOllama(checked) }}
              />
            </label>
            <p className={css.hint}>{t('useOllamaHint')}</p>
            {!state.apiKeyConfigured && <p className={css.hint}>{t('apiKeyUnset')}</p>}
          </div>
        )
        : null}
      <SettingsValueField
        id="plugin-config-ollama-search-count"
        label={t('maxResults')}
        hint={t('maxResultsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        numeric
        disabled={disabled}
        {...state.maxResults}
        onEdit={(text) => { props.edit('maxResults', text) }}
        onReset={() => { props.resetField('maxResults') }}
      />
    </SettingsForm>
  )
}
