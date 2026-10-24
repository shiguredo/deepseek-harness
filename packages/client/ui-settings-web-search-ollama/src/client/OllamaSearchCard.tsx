/**
 * The Ollama Cloud web provider's settings page: whether this deployment uses
 * it, its key, the endpoint each operation reaches, and the result count search
 * applies when a caller names none.
 */

import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { SettingsForm, SettingsSecretField, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
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
                disabled={disabled}
                onChange={(checked) => { props.setOllama(checked) }}
              />
            </label>
            <p className={css.hint}>{t('useOllamaHint')}</p>
          </div>
        )
        : null}
      <SettingsSecretField
        id="plugin-config-ollama-search-key"
        label={t('apiKey')}
        hint={t('apiKeyHint')}
        // The credentials domain accepts a key even when the settings document
        // itself is read-only; they are separate stores with separate refusals.
        // Its own writability is what disables this control — a key sourced
        // from the process environment cannot be written from here.
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('apiKeySet') : t('apiKeyUnset')}
        onEdit={(text) => { props.edit('apiKey', text) }}
      />
      <SettingsValueField
        id="plugin-config-ollama-search-endpoint"
        label={t('searchBaseUrl')}
        hint={t('searchBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        placeholder={state.searchPlaceholder}
        disabled={disabled}
        {...state.searchBaseURL}
        onEdit={(text) => { props.edit('searchBaseURL', text) }}
        onReset={() => { props.resetField('searchBaseURL') }}
      />
      <SettingsValueField
        id="plugin-config-ollama-fetch-endpoint"
        label={t('fetchBaseUrl')}
        hint={t('fetchBaseUrlHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        placeholder={state.fetchPlaceholder}
        disabled={disabled}
        {...state.fetchBaseURL}
        onEdit={(text) => { props.edit('fetchBaseURL', text) }}
        onReset={() => { props.resetField('fetchBaseURL') }}
      />
      <SettingsValueField
        id="plugin-config-ollama-search-results"
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
