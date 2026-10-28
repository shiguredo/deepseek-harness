/**
 * The Ollama Cloud web page's staged forms: the `web-ollama-api` section that
 * carries the default result count and the `web` section whose provider
 * selection the switch stages.
 *
 * The switch selects the Ollama Cloud search and fetch providers together, or
 * restores the deployment's own selection. A selection equal to the composed
 * value clears the override instead of storing a copy of it. The endpoints and
 * the API key are not settings: both endpoints are Ollama Cloud's public ones,
 * and the key is the one the Ollama Cloud model route already stores.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { SettingsFormModel, settingsNumberField, settingsTextField } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SettingsFieldState, SettingsFormActions, SettingsFormScope, SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'

/** Settings namespace of the Ollama Cloud web provider (its Loader row id). */
export const WEB_OLLAMA_NS = 'web-ollama-api'

/** Namespace of the web service's provider selection. */
export const WEB_NS = 'web'

/** Provider ids the switch writes into the web service's selection. */
const PROVIDERS = {
  searchProvider: { on: 'ollama-cloud-search', off: 'deepseek-official' },
  fetchProvider: { on: 'ollama-cloud-fetch', off: 'http' },
} as const

/** Credential reference the provider resolves; the Ollama Cloud model route stores its key here. */
const API_KEY_REF = 'OLLAMA_CLOUD_API_KEY'

/** The web service's provider selection. */
export interface WebProviderSelection {
  /** Search provider id. */
  searchProvider?: string
  /** Fetch provider id. */
  fetchProvider?: string
}

/** The Ollama Cloud fields this page edits — a subset of the served schema by design. */
export interface OllamaSearchSettings {
  /** Default result count when a search request carries no bound. */
  maxResults?: number
}

/** What the credentials domain last reported for the shared key. */
interface CredentialState {
  /** Whether any layer supplies a value for it. */
  configured: boolean
}

/** What the Ollama Cloud web page renders. */
export interface OllamaSearchCardState extends SettingsFormShell {
  /** Whether the Host serves both the selection and the provider section. */
  switchAvailable: boolean
  /** Staged switch position: true selects the Ollama Cloud search and fetch providers. */
  useOllama: boolean
  /** Default result count. */
  maxResults: SettingsFieldState
  /** Whether the Host reports a credential configured at {@link API_KEY_REF}. */
  apiKeyConfigured: boolean
}

/** The registration-side face the Ollama Cloud web page's slot entry injects. */
export interface OllamaSearchCardFace extends SettingsFormActions {
  hooks: {
    /** Page snapshot bound by the renderer as useOllamaSearchCard. */
    ollamaSearchCard: SnapshotStore<OllamaSearchCardState>
  }
  /** Stage the switch: true selects Ollama Cloud search and fetch, false restores the deployment's selection. */
  setOllama: (enabled: boolean) => void
}

/** Settings scopes for the namespaces the page edits. */
export interface OllamaSearchCardScopes {
  /** The web service's provider selection. */
  web: SettingsFormScope<WebProviderSelection>
  /** The Ollama Cloud web provider's own fields. */
  provider: SettingsFormScope<OllamaSearchSettings>
}

/** Bridges the provider section, the provider selection, and the credentials domain onto the page. */
export class OllamaSearchCardController {
  private readonly provider: SettingsFormModel<OllamaSearchSettings>
  private readonly selection: SettingsFormModel<WebProviderSelection>
  private readonly store: SnapshotStore<OllamaSearchCardState>
  private readonly unsubscribe: (() => void)[]
  private credential: CredentialState = { configured: false }

  /**
   * @param scopes - the bound settings scopes for the page's namespaces.
   * @param ctx - the page plugin's context, whose `remote.credentials` namespace
   * answers for the reference the section names.
   */
  constructor(
    private readonly scopes: OllamaSearchCardScopes,
    private readonly ctx: ClientContext,
  ) {
    this.provider = new SettingsFormModel(scopes.provider, [settingsNumberField('maxResults')])
    this.selection = new SettingsFormModel(scopes.web, [
      settingsTextField('searchProvider'), settingsTextField('fetchProvider'),
    ])
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = [
      // The forms publish drafts and section reads; the credential answer
      // publishes nothing there, so every projection is written from here.
      ...[this.provider, this.selection].map(form => form.bind(() => form.shell()).subscribe(() => { this.store.set(this.projection()) })),
    ]
    void this.readCredential()
  }

  /** Whether the Host serves both sections the switch needs. */
  private switchAvailable(): boolean {
    return this.provider.shell().available && this.selection.shell().available
  }

  /** The staged switch position, read from the staged search selection. */
  private ollamaSelected(): boolean {
    return this.switchAvailable() && this.selection.field('searchProvider').text === PROVIDERS.searchProvider.on
  }

  private projection(): OllamaSearchCardState {
    const primary = this.provider.shell()
    const served = [primary, this.selection.shell()].filter(item => item.available)
    const shell: SettingsFormShell = {
      available: primary.available,
      writable: served.every(item => item.writable),
      dirty: served.some(item => item.dirty),
      invalid: served.some(item => item.invalid),
      saving: served.some(item => item.saving),
      failed: served.some(item => item.failed),
    }
    return {
      ...shell,
      switchAvailable: this.switchAvailable(),
      useOllama: this.ollamaSelected(),
      maxResults: this.provider.field('maxResults'),
      apiKeyConfigured: this.credential.configured,
    }
  }

  /**
   * Ask the credentials domain whether the shared Ollama Cloud key resolves.
   *
   * Two reads can settle out of order; only an answer for the reference this
   * build addresses is published.
   */
  private async readCredential(): Promise<void> {
    const response = await this.ctx.remote.credentials.describe([API_KEY_REF])
    if (!response.ok) return
    const configured = response.value[API_KEY_REF]?.configured ?? false
    if (configured === this.credential.configured) return
    this.credential = { configured }
    this.store.set(this.projection())
  }

  /**
   * Re-read after the Host reports a change to the shared key.
   *
   * The key belongs to the Ollama Cloud model route, so it is stored on the
   * Models page; this page learns about that write only from this event.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== API_KEY_REF) return
    void this.readCredential()
  }

  /**
   * Build the face the page's slot registration injects. The result count edits
   * its own section; the switch stages the selection.
   * @returns the page's snapshot and its form actions.
   */
  inject(): OllamaSearchCardFace {
    return {
      hooks: { ollamaSearchCard: this.store },
      edit: (field, text) => { this.provider.actions().edit(field, text) },
      resetField: (field) => { this.provider.actions().resetField(field) },
      save: () => { void this.save() },
      discard: () => {
        this.provider.actions().discard()
        this.selection.actions().discard()
      },
      setOllama: (enabled) => { this.select(enabled) },
    }
  }

  /** Release the section, selection, and form subscriptions. */
  dispose(): void {
    for (const off of this.unsubscribe) off()
    this.provider.dispose()
    this.selection.dispose()
  }

  /**
   * Stage both provider selections for one switch position. Turning the
   * switch on selects the Ollama Cloud ids, clearing the override when the
   * deployment already composes them. Turning it off clears the override, so
   * the deployment's own selection applies again; only a deployment that
   * composes the Ollama Cloud pair itself needs an explicit alternative, and
   * the shipped one is the only other selection this page can name.
   * @param enabled - true selects the Ollama Cloud search and fetch providers.
   */
  private select(enabled: boolean): void {
    const base = this.scopes.web.getSnapshot().base as WebProviderSelection | undefined
    const actions = this.selection.actions()
    for (const field of ['searchProvider', 'fetchProvider'] as const) {
      const ollama = PROVIDERS[field].on
      const composed = base?.[field]
      if (enabled) {
        if (composed === ollama) actions.resetField(field)
        else actions.edit(field, ollama)
      } else if (composed !== ollama) {
        actions.resetField(field)
      } else {
        actions.edit(field, PROVIDERS[field].off)
      }
    }
  }

  /**
   * Save the provider section before the selection, so a switch takes effect
   * only after the result count it applies has landed. A refused section stops
   * the selection from saving and keeps every remaining draft for correction.
   * @returns settlement after every attempted write.
   */
  private async save(): Promise<void> {
    const state = this.projection()
    if (!state.available || state.invalid || state.saving) return
    if (this.provider.shell().available && this.provider.shell().dirty) {
      await this.provider.save()
      if (this.provider.shell().failed) return
    }
    if (this.selection.shell().dirty) await this.selection.save()
  }
}
