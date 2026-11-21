/**
 * Wire types of the Models page's provider sign-in surface: what the browser
 * lists, and the polled view of one attempt it drives.
 *
 * Nothing here carries a credential: an attempt reports progress, the page the
 * human must open, and the questions the flow asks; the record itself stays in
 * the Host credential store.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-models-signin/types
 */

/** One method a provider's sign-in offers, in the flow's preferred order. */
export interface SignInMethodView {
  /** Method id the flow declared, such as `oauth`. */
  readonly id: string
  /** User-facing label, already in OpenAI's own wording where the flow supplies one. */
  readonly label: string
}

/** One provider's sign-in as the Models page lists it. */
export interface SignInFlowView {
  /** Credential record the flow writes, as `<scope>/<id>`; the page passes this back to start one. */
  readonly key: string
  /** Provider route id the record belongs to, such as `openai`. */
  readonly provider: string
  /** User-facing name of what is being authorized. */
  readonly label: string
  /** Methods this flow offers, most preferred first. */
  readonly methods: readonly SignInMethodView[]
  /** Whether a credential record already exists for this flow's key. */
  readonly signedIn: boolean
  /**
   * What the stored record is: `grant` when a sign-in wrote it, which is the
   * case whose usage the ChatGPT plan pays for; `api-key` when the card's own
   * key field wrote it; `none` before either.
   */
  readonly credential: 'none' | 'api-key' | 'grant'
}

/**
 * Provider failure code OpenAI returns when a request outruns the plan usage a
 * sign-in authorized. pi-ai flattens provider failures to their message text —
 * as the adapter's own error classifier already notes — so a surface detects
 * this state by finding this code in the reported failure.
 */
export const PLAN_USAGE_LIMIT_CODE = 'subscription_sharing_usage_limit_exceeded'

/** One thing a running attempt told the human. */
export interface SignInNoticeView {
  /** Attempt-local order, so a surface can tell a new notice from a repeated message. */
  readonly seq: number
  /** What is happening, or what the human must do next. */
  readonly message: string
  /** A page the human must open to continue. */
  readonly url?: string
  /** A short code the human must enter on that page. */
  readonly code?: string
}

/** One question the running flow asks the human. */
export interface SignInPromptView {
  /** Attempt-local identity; answers name it so a superseded question cannot be answered. */
  readonly id: number
  /** How the surface should ask. */
  readonly kind: 'text' | 'secret' | 'select'
  /** What to ask. */
  readonly message: string
  /** Placeholder for a typed answer. */
  readonly placeholder?: string
  /** Choices for a `select` prompt. */
  readonly options?: readonly SignInPromptOptionView[]
}

/** One choice a `select` prompt offers. */
export interface SignInPromptOptionView {
  /** Value returned when chosen. */
  readonly id: string
  /** User-facing label. */
  readonly label: string
  /** Optional extra context for surfaces that render it. */
  readonly description?: string
}

/**
 * Where one attempt stands. `waiting` covers the browser step, including the
 * stage where the human is expected to paste the callback URL back; the flow
 * itself decides when to move on.
 */
export type SignInPhase = 'starting' | 'waiting' | 'succeeded' | 'failed' | 'cancelled'

/** The polled view of one sign-in attempt. */
export interface SignInAttemptView {
  /** Attempt identity the page polls and cancels. */
  readonly id: string
  /** Credential record the attempt is authorizing, as `<scope>/<id>`. */
  readonly key: string
  /** Method id the attempt runs. */
  readonly method: string
  /** Where the attempt stands. */
  readonly phase: SignInPhase
  /** Everything the flow has reported so far, oldest first. */
  readonly notices: readonly SignInNoticeView[]
  /** The question the flow is waiting on, or null while it works on its own. */
  readonly prompt: SignInPromptView | null
  /** Why the attempt failed, once it did. */
  readonly error?: string
}
