/**
 * The Ollama Cloud web page's staged forms: the `web-ollama-api` section that
 * carries the two endpoints and the default result count, the `web` section
 * whose provider selection the switch stages, and the key — which is written
 * through the credentials domain, never into the settings section, so the
 * literal never rides a response.
 *
 * The switch selects the Ollama Cloud search and fetch providers together, or
 * restores the deployment's own selection. A selection equal to the composed
 * value clears the override instead of storing a copy of it. The key is the one
 * control that does not live in a section; it is still staged with the rest of
 * the form, so one save covers everything the page shows.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  SettingsFormModel, settingsNumberField, settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SettingsFieldState, SettingsFormActions, SettingsFormScope, SettingsFormScopeSnapshot, SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'

/** Settings namespace of the Ollama Cloud web provider (its Loader row id). */
export const WEB_OLLAMA_NS = 'web-ollama-api'

/** Namespace of the web service's provider selection. */
export const WEB_NS = 'web'

/** Provider ids the switch writes into the web service's selection. */
const PROVIDERS = {
  searchProvider: { on: 'ollama-cloud', off: 'deepseek-official' },
  fetchProvider: { on: 'ollama-cloud-fetch', off: 'http' },
} as const

/**
 * Endpoints an empty field resolves to, spelled here rather than imported: a
 * client package must not depend on a Host package. The hint beside each field
 * says the provider appends the operation path to a base, so both the base and
 * this full URL are valid values.
 */
const DEFAULT_SEARCH_URL = 'https://ollama.com/api/web_search'
const DEFAULT_FETCH_URL = 'https://ollama.com/api/web_fetch'

/** Credential reference the provider resolves when its section names none. */
const DEFAULT_API_KEY_REF = 'OLLAMA_CLOUD_API_KEY'

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/** The web service's provider selection. */
export interface WebProviderSelection {
  /** Search provider id. */
  searchProvider?: string
  /** Fetch provider id. */
  fetchProvider?: string
}

/** The Ollama Cloud fields this page edits — a subset of the served schema by design. */
export interface OllamaSearchSettings {
  /** Credential reference naming the environment key. */
  apiKeyEnv?: string
  /** Search endpoint base or the full URL; blank inherits the provider default. */
  searchBaseURL?: string
  /** Fetch endpoint base or the full URL; blank inherits the provider default. */
  fetchBaseURL?: string
  /** Default result count when a search request carries no bound. */
  maxResults?: number
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. */
  configured: boolean
  /** Whether `credentials/set` can affect it; false disables the control. */
  writable: boolean
}

/** What the Ollama Cloud web page renders. */
export interface OllamaSearchCardState extends SettingsFormShell {
  /** Whether the Host serves both the selection and the provider section. */
  switchAvailable: boolean
  /** Staged switch position: true selects the Ollama Cloud search and fetch providers. */
  useOllama: boolean
  /** Search endpoint. */
  searchBaseURL: SettingsFieldState
  /** Fetch endpoint. */
  fetchBaseURL: SettingsFieldState
  /** Endpoint the search field resolves to when it is empty, shown faintly. */
  searchPlaceholder: string
  /** Endpoint the fetch field resolves to when it is empty, shown faintly. */
  fetchPlaceholder: string
  /** Default result count. */
  maxResults: SettingsFieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: SettingsFieldState
  /** Whether the Host reports a credential configured for the referenced key. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  apiKeyWritable: boolean
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
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  /**
   * @param scopes - the bound settings scopes for the page's namespaces.
   * @param ctx - the page plugin's context, whose `remote.credentials` namespace
   * answers for the reference the section names.
   */
  constructor(
    private readonly scopes: OllamaSearchCardScopes,
    private readonly ctx: ClientContext,
  ) {
    this.provider = new SettingsFormModel(scopes.provider, [
      settingsTextField('searchBaseURL'),
      settingsTextField('fetchBaseURL'),
      settingsNumberField('maxResults'),
    ], [{ field: API_KEY_FIELD, write: text => this.writeKey(text) }])
    this.selection = new SettingsFormModel(scopes.web, [
      settingsTextField('searchProvider'), settingsTextField('fetchProvider'),
    ])
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = [
      // The forms publish drafts and section reads; the credential answer
      // publishes nothing there, so every projection is written from here.
      ...[this.provider, this.selection].map(form => form.bind(() => form.shell()).subscribe(() => { this.store.set(this.projection()) })),
      // A staged switch can change which section names the key, without any
      // scope publishing; a scope change can rename the reference itself.
      ...[scopes.web, scopes.provider].map(scope => scope.subscribe(() => { void this.readCredential() })),
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
      searchBaseURL: this.provider.field('searchBaseURL'),
      fetchBaseURL: this.provider.field('fetchBaseURL'),
      searchPlaceholder: DEFAULT_SEARCH_URL,
      fetchPlaceholder: DEFAULT_FETCH_URL,
      maxResults: this.provider.field('maxResults'),
      apiKey: this.provider.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    }
  }

  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyEnv` can change
   * between the request and its response, and two reads can settle out of order,
   * so a response is published only while it still answers for the reference in
   * force.
   */
  private async readCredential(): Promise<void> {
    const ref = this.activeRef()
    if (ref !== this.credential.ref) {
      // A new reference knows nothing yet; keeping the old answer would claim
      // the key is configured under a name nobody has checked.
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== this.activeRef()) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the page guessing a refusal.
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  /**
   * Re-read after the Host reports a change to the reference this page watches.
   *
   * A key can be written from somewhere else — the Models page addresses the
   * same environment — and the settings section does not change when it is, so
   * without this the badge keeps reporting a state the Host already replaced.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.activeRef()) return
    void this.readCredential()
  }

  /**
   * Build the face the page's slot registration injects. Endpoint, result count,
   * and the key edit their own section; the switch stages the selection.
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
   * only after the endpoints it uses have landed. A refused section stops the
   * selection from saving and keeps every remaining draft for correction.
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

  /**
   * Write the staged key, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  private async writeKey(value: string): Promise<boolean> {
    // Refusals surface through the re-read below: the Host is the only
    // authority on whether the key now exists.
    await this.ctx.remote.credentials.set(this.activeRef(), value)
    await this.readCredential()
    return this.credential.configured
  }

  /** @returns the credential reference the provider section names, or the provider's default. */
  private activeRef(): string {
    return refOf(this.scopes.provider.getSnapshot())
  }
}

/**
 * The credential reference the section names, or the provider's default.
 * @param snapshot - the section's current scope snapshot.
 * @returns the reference to address.
 */
function refOf(snapshot: SettingsFormScopeSnapshot<OllamaSearchSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
}
