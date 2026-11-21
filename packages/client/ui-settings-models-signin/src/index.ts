/**
 * Provider sign-in surface for the Models page, Host half.
 *
 * The browser lists the authorization flows this composition registered and
 * drives one attempt through a polled view: a provider can be signed into from
 * the settings page, including the paste step a remote browser needs, without
 * a terminal. The flow itself, its notices, and its prompts belong to the
 * authorization seam; this service only carries them across the wire and
 * tracks one surface's attempt.
 *
 * @module @deepseek-ai/dsh-client-ui-settings-models-signin
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationPrompt } from '@deepseek-ai/dsh-authorization'
import { AuthorizationDeclinedError } from '@deepseek-ai/dsh-authorization'
import type { CredentialKey } from '@deepseek-ai/dsh-credentials'
import { credentialKeyId, parseCredentialKey } from '@deepseek-ai/dsh-credentials'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {
  SignInAttemptView, SignInFlowView, SignInNoticeView, SignInPhase, SignInPromptOptionView, SignInPromptView,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `modelSignIn` Remote namespace. */
    modelSignIn: ModelSignIn
  }
}

/** One question the flow is waiting on, with the promise its answer settles. */
interface PendingPrompt {
  readonly view: SignInPromptView
  readonly resolve: (value: string) => void
  readonly reject: (error: Error) => void
}

/** One attempt this surface started and has not dismissed. */
interface Attempt {
  readonly id: string
  readonly key: CredentialKey
  readonly method: string
  phase: SignInPhase
  readonly notices: SignInNoticeView[]
  prompt: PendingPrompt | null
  error?: string
}

/** Restate one authorization prompt in the wire vocabulary. */
function promptView(id: number, prompt: AuthorizationPrompt): SignInPromptView {
  switch (prompt.kind) {
    case 'select': {
      const options: SignInPromptOptionView[] = prompt.options.map(option => ({
        id: option.id,
        label: option.label,
        ...option.description === undefined ? {} : { description: option.description },
      }))
      return { id, kind: 'select', message: prompt.message, options }
    }
    case 'secret':
    case 'text':
      return {
        id,
        kind: prompt.kind,
        message: prompt.message,
        ...prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder },
      }
    default:
      // The seam's prompt union is closed; a build that meets a new member asks
      // for a plain answer rather than stalling the flow.
      return { id, kind: 'text', message: 'Answer to continue signing in.' }
  }
}

/**
 * Host owner of the Models page's provider sign-in Remote.
 *
 * One attempt per provider is enough for one surface: the authorization seam
 * already refuses a second attempt for the same credential record, so a second
 * browser tab hears that refusal instead of racing this one.
 */
export class ModelSignIn extends TypertRemoteService {
  static inject = ['authorization', 'credentials']

  private readonly attempts = new Map<string, Attempt>()
  private promptSeq = 0

  constructor(ctx: Context) {
    super(ctx, 'modelSignIn')
  }

  /**
   * List every provider sign-in this composition offers.
   * @returns one entry per registered flow, with its methods and whether a credential is stored.
   */
  @Remote
  async list(): Promise<SignInFlowView[]> {
    return await Promise.all(this.ctx.authorization.list().map(async (entry) => {
      const stored = await this.ctx.credentials.readRecord(entry.key)
      return {
        key: String(entry.key),
        provider: credentialKeyId(entry.key),
        label: entry.label,
        methods: entry.methods.map(method => ({ id: method.id, label: method.label })),
        signedIn: stored !== undefined,
        credential: stored === undefined ? 'none' : stored.kind,
      }
    }))
  }

  /**
   * Start one attempt and return its first view.
   * @param key - credential record the flow writes, as `<scope>/<id>`.
   * @param method - one method id the flow declared.
   * @returns the attempt's view; poll {@link poll} for later phases.
   * @throws when the key is malformed, no flow claims it, or one is already running.
   */
  @Remote
  begin(key: string, method: string): SignInAttemptView {
    const parsed = parseCredentialKey(key)
    const attempt: Attempt = {
      id: randomUUID(),
      key: parsed,
      method,
      phase: 'starting',
      notices: [],
      prompt: null,
    }
    this.attempts.set(attempt.id, attempt)
    void this.run(attempt)
    return this.viewOf(attempt)
  }

  /**
   * Read one attempt's current view.
   * @param id - attempt identity returned by {@link begin}.
   * @returns the view, or undefined once this Host forgot the attempt.
   */
  @Remote
  poll(id: string): SignInAttemptView | undefined {
    const attempt = this.attempts.get(id)
    return attempt === undefined ? undefined : this.viewOf(attempt)
  }

  /**
   * Answer the question the attempt is waiting on.
   * @param id - attempt identity.
   * @param promptId - the question's id, so a superseded question cannot be answered.
   * @param value - what the human typed or chose.
   * @returns the attempt's view after the answer is delivered.
   * @throws when the attempt is unknown or the question is no longer pending.
   */
  @Remote
  answer(id: string, promptId: number, value: string): SignInAttemptView {
    const attempt = this.require(id)
    const pending = attempt.prompt
    if (pending === null || pending.view.id !== promptId) {
      throw new Error('this sign-in no longer asks that question')
    }
    attempt.prompt = null
    pending.resolve(value)
    return this.viewOf(attempt)
  }

  /**
   * Withdraw one attempt.
   * @param id - attempt identity.
   * @returns the attempt's view, already marked cancelled.
   */
  @Remote
  cancel(id: string): SignInAttemptView {
    const attempt = this.require(id)
    if (attempt.phase === 'starting' || attempt.phase === 'waiting') {
      attempt.phase = 'cancelled'
      this.settlePrompt(attempt, new AuthorizationDeclinedError('the sign-in was cancelled'))
      this.ctx.authorization.cancel(attempt.key)
    }
    return this.viewOf(attempt)
  }

  /**
   * Forget one provider's stored credential record.
   * @param key - credential record the flow writes, as `<scope>/<id>`.
   * @throws when an attempt for that record is running.
   */
  @Remote
  async signOut(key: string): Promise<void> {
    const parsed = parseCredentialKey(key)
    for (const attempt of this.attempts.values()) {
      if (attempt.key === parsed && (attempt.phase === 'starting' || attempt.phase === 'waiting')) {
        throw new Error('a sign-in for this provider is still running')
      }
    }
    await this.ctx.credentials.deleteRecord(parsed)
  }

  /** Run one attempt to its settlement, reporting phases the surface polls. */
  private async run(attempt: Attempt): Promise<void> {
    try {
      const outcome = await this.ctx.authorization.begin({
        key: attempt.key,
        method: attempt.method,
        interaction: {
          notify: (notice) => {
            attempt.notices.push({ seq: attempt.notices.length + 1, ...notice })
            if (attempt.phase === 'starting') attempt.phase = 'waiting'
          },
          prompt: prompt => this.ask(attempt, prompt),
        },
      })
      attempt.phase = outcome.status === 'authorized' ? 'succeeded' : 'cancelled'
    } catch (error) {
      if (attempt.phase === 'cancelled') return
      attempt.phase = 'failed'
      attempt.error = error instanceof Error ? error.message : String(error)
      this.settlePrompt(attempt, new AuthorizationDeclinedError('the sign-in failed before it was answered'))
    } finally {
      attempt.prompt = null
    }
  }

  /** Ask the human one question and hold the attempt until it is answered or withdrawn. */
  private ask(attempt: Attempt, prompt: AuthorizationPrompt): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const id = ++this.promptSeq
      attempt.prompt = { view: promptView(id, prompt), resolve, reject }
      if (attempt.phase === 'starting') attempt.phase = 'waiting'
      prompt.signal?.addEventListener('abort', () => {
        if (attempt.prompt?.view.id !== id) return
        attempt.prompt = null
        reject(new Error('the sign-in question was withdrawn'))
      }, { once: true })
    })
  }

  /** Reject and clear the pending question, if one is still waiting. */
  private settlePrompt(attempt: Attempt, error: Error): void {
    const pending = attempt.prompt
    attempt.prompt = null
    pending?.reject(error)
  }

  /** The attempt a surface names, or a loud failure for a forgotten one. */
  private require(id: string): Attempt {
    const attempt = this.attempts.get(id)
    if (attempt === undefined) throw new Error('this sign-in attempt is not known to the Host')
    return attempt
  }

  /** Detach one attempt's current state for the wire. */
  private viewOf(attempt: Attempt): SignInAttemptView {
    return {
      id: attempt.id,
      key: String(attempt.key),
      method: attempt.method,
      phase: attempt.phase,
      notices: [...attempt.notices],
      prompt: attempt.prompt?.view ?? null,
      ...attempt.error === undefined ? {} : { error: attempt.error },
    }
  }
}

export default ModelSignIn
