/**
 * Authorization flows for the pi-ai providers that ship a login. This is the
 * whole of the translation between the harness's neutral notice/prompt
 * vocabulary and pi-ai's `AuthInteraction`; nothing above it knows which
 * library ran the conversation.
 *
 * One catalog provider's sign-in identifies the app installation rather than
 * the route, so it needs an installation id and a deployment decision; every
 * other flow runs without either.
 *
 * That flow is OpenAI's Sign in with ChatGPT, which spends the user's ChatGPT
 * plan instead of an API key. OpenAI's help center names Go, Plus, Pro, and
 * Business subscribers for plan usage, and the authorization either grants it
 * or refuses it, so eligibility is decided there and never here. A Business
 * workspace is the one case with a second gate: Standard and Premium seats draw
 * the included allowance under that workspace's controls, a usage-based seat
 * spends workspace credits and only with permission, and this adapter neither
 * reads nor guesses which arrangement a seat has. The consent screen, the
 * plan's limits, the usage settings page, and the Sign in with ChatGPT Terms the
 * integration runs under are OpenAI's as well: this module carries their
 * conversation and stores the credential their exchange returns, and claims
 * nothing on their behalf. Those terms also bind how a request may be made —
 * from the signed-in user's own runtime, for the app that user connected, free
 * of charge to them — which is why the credential stays on the host that runs
 * the flow.
 *
 * @module dsh-llm-pi-ai/login
 */

import type { AuthEvent, AuthPrompt, AuthType, Provider } from '@earendil-works/pi-ai'
import type { Context } from '@deepseek-ai/cordis'
import type { AuthorizationMethod, AuthorizationPrompt, AuthorizationSession } from '@deepseek-ai/dsh-authorization'
import { isCredentialKeySegment } from '@deepseek-ai/dsh-credentials'
import { APP_IDENTITY } from '@deepseek-ai/dsh-llm'
import { catalogProvider, catalogProviderIds } from './catalog.ts'
import { readAgentHostId } from './installation-id.ts'
import { recordKeyFor } from './auth.ts'
import type { PiAiAuthInjection } from './adapter.ts'
import { createModels } from './models.ts'

/** The one catalog provider whose OAuth sign-in a deployment must opt into. */
const CHAT_GPT_PROVIDER = 'openai'

/** OpenAI's wording for the action that starts its ChatGPT plan sign-in. */
const CONTINUE_WITH_CHATGPT = 'Continue with ChatGPT'

/**
 * The label this harness shows for a catalog provider's account sign-in, where
 * pi-ai's own name would misstate it.
 *
 * `openai` is named for the action OpenAI publishes. `openai-codex` runs a
 * different flow — Codex's own browser or device-code grant — and pi-ai names
 * it after the two plan tiers it was written against; OpenAI admits Go, Plus,
 * Pro, and Business subscribers to ChatGPT plan usage, so a name counting two
 * of them would turn away the others.
 */
const ACCOUNT_SIGN_IN_LABELS: Readonly<Record<string, string>> = {
  [CHAT_GPT_PROVIDER]: CONTINUE_WITH_CHATGPT,
  'openai-codex': 'OpenAI (ChatGPT plan)',
}

/** The one catalog provider whose flow asks which login method to use. */
const CODE_PROVIDER = 'openai-codex'

/** The method that flow runs when it is not told to use a device code. */
const BROWSER_LOGIN_METHOD = 'browser'

/** The headless method this surface answers past, and the option id that names it. */
const DEVICE_CODE_LOGIN_METHOD = 'device_code'

/** The deployment decisions a flow offers depend on. */
export interface PiAiFlowOptions {
  /**
   * Offer pi-ai's Sign in with ChatGPT for the `openai` route. The flow tells
   * OpenAI which app installation is asking, through the id
   * {@link readAgentHostId} persists, and asks the user to authorize ChatGPT
   * plan usage for it; disabled, that route signs in with an API key alone and
   * the stored record of an earlier sign-in still authenticates the requests
   * it made before.
   */
  readonly chatGptSignIn?: boolean | undefined
}

/**
 * The login methods one catalog provider offers.
 *
 * A method appears only when pi-ai can actually run it: `oauth` carries a
 * `login` that runs without app-supplied login options except for
 * {@link CHAT_GPT_PROVIDER}, whose flow needs the installation id and stays
 * behind {@link PiAiFlowOptions.chatGptSignIn}; an api-key method has a
 * `login` only when the provider collects its key interactively — which every
 * installed one currently does, so a key is typed into pi-ai's own prompt
 * rather than into the settings form.
 * @param provider - the installed catalog provider, if pi-ai ships one.
 * @param options - deployment decisions about the opt-in account sign-in.
 * @returns its methods, most preferred first; empty when it offers no login.
 */
function loginMethods(provider: Provider | undefined, options: PiAiFlowOptions): AuthorizationMethod[] {
  const methods: AuthorizationMethod[] = []
  const optedIn = provider?.id !== CHAT_GPT_PROVIDER || options.chatGptSignIn === true
  const oauth = provider === undefined || !optedIn ? undefined : provider.auth.oauth
  if (oauth !== undefined) {
    const providerId = provider?.id
    methods.push({
      id: 'oauth',
      label: (providerId === undefined ? undefined : ACCOUNT_SIGN_IN_LABELS[providerId]) ?? oauth.loginLabel ?? oauth.name,
    })
  }
  const apiKey = provider?.auth.apiKey
  if (apiKey?.login !== undefined) methods.push({ id: 'api-key', label: apiKey.name })
  return methods
}

/**
 * Restate one pi-ai login event in the seam's vocabulary.
 *
 * A device-code grant is the one event carrying two things the human needs at
 * once — where to go and what to type there — which is why the neutral notice
 * has a `code` beside its `url` rather than folding the code into the message.
 * @param event - what pi-ai reported.
 * @param session - the attempt to report it to.
 */
function relay(event: AuthEvent, session: AuthorizationSession): void {
  switch (event.type) {
    case 'info': {
      const link = event.links?.[0]
      session.notify({ message: event.message, ...link === undefined ? {} : { url: link.url } })
      return
    }
    case 'auth_url':
      session.notify({
        message: event.instructions ?? 'Open this page to continue signing in.',
        url: event.url,
      })
      return
    case 'device_code':
      session.notify({
        message: 'Enter this code on the verification page to finish signing in.',
        url: event.verificationUri,
        code: event.userCode,
      })
      return
    case 'progress':
      session.notify({ message: event.message })
      return
    default:
      // pi-ai's event union is open to new members: a build that meets one it
      // does not know still shows the human that something is happening rather
      // than going silent mid-login.
      session.notify({ message: 'Signing in…' })
  }
}

/**
 * Restate one pi-ai prompt in the seam's vocabulary.
 *
 * `manual_code` becomes a plain text question because the difference pi-ai
 * draws — a code the human copies from a browser rather than a value they know
 * — changes nothing a surface renders. Its own `signal` is carried through, and
 * that is the part which matters: it is how a flow racing a typed code against
 * a browser callback withdraws the losing question.
 * @param prompt - what pi-ai asked.
 * @returns the neutral prompt to put to the human.
 */
function restate(prompt: AuthPrompt): AuthorizationPrompt {
  const signal = prompt.signal === undefined ? {} : { signal: prompt.signal }
  switch (prompt.type) {
    case 'select':
      return { ...signal, kind: 'select', message: prompt.message, options: prompt.options }
    case 'secret':
      return {
        ...signal,
        kind: 'secret',
        message: prompt.message,
        ...prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder },
      }
    default:
      return {
        ...signal,
        kind: 'text',
        message: prompt.message,
        ...prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder },
      }
  }
}

/**
 * Register one authorization flow per installed provider that ships a login.
 *
 * Registration is unconditional on configuration: a provider has to be signed
 * into before a route for it is worth adding, so the flow exists from the
 * moment the plugin mounts rather than appearing once a profile does.
 * @param ctx - the plugin context carrying `ctx.authorization`.
 * @param auth - the injectables every collection here is built with.
 * @param options - deployment decisions about the opt-in account sign-in.
 */
export function registerPiAiFlows(ctx: Context, auth: PiAiAuthInjection, options: PiAiFlowOptions = {}): void {
  for (const providerId of catalogProviderIds()) {
    const provider = catalogProvider(providerId)
    const [first, ...rest] = loginMethods(provider, options)
    // A bundled route (or, defensively, an installed provider that ships no
    // login) has nothing to sign into: it authenticates through `apiKeyEnv` or
    // the process environment, which is a settings-page action rather than a
    // flow, so it contributes no entry here.
    if (provider === undefined || first === undefined) continue
    /* v8 ignore next 7 -- every installed catalog id is a lowercase
       hyphenated identifier; the guard keeps a future upstream id outside the
       record grammar (dotted or uppercase, as vendor ids elsewhere already
       are) from throwing in `recordKeyFor` and failing the whole mount. */
    if (!isCredentialKeySegment(providerId)) {
      ctx.logger.warn(
        'llm-pi-ai: catalog provider "%s" cannot address a credential record; its sign-in is not offered',
        providerId)
      continue
    }
    ctx.authorization.registerFlow({
      key: recordKeyFor(providerId),
      label: provider.name,
      methods: [first, ...rest],
      async run(session) {
        // A collection of its own, holding only the provider being signed
        // into: login is not serving requests, and the credential it produces
        // lands in the shared store either way.
        const models = createModels(auth)
        models.setProvider(provider)
        // Total over the two ids declared above, and the seam only ever hands
        // back one a flow declared.
        const type: AuthType = session.method === 'oauth' ? 'oauth' : 'api_key'
        const interaction = {
          signal: session.signal,
          notify: (event: AuthEvent) => { relay(event, session) },
          prompt: (prompt: AuthPrompt) => {
            // The Codex flow opens by offering a headless device-code grant
            // beside the browser one. This surface finishes through the browser
            // step or, on a remote browser, through the redirect URL that step
            // lands on, so the device-code branch would ask the human to carry a
            // code to another page for a path nothing here needs — and a code
            // the panel cannot act on is a question worth not asking.
            if (providerId === CODE_PROVIDER && prompt.type === 'select'
              && prompt.options.some(option => option.id === DEVICE_CODE_LOGIN_METHOD)) {
              return Promise.resolve(BROWSER_LOGIN_METHOD)
            }
            return session.prompt(restate(prompt))
          },
        }
        // Only OpenAI's account sign-in names this installation; reading the id
        // elsewhere would mint an identifier no flow uses.
        const agentHostId = providerId === CHAT_GPT_PROVIDER ? await readAgentHostId() : undefined
        // pi-ai persists what the login returns through that same store, which
        // is what makes it the single writer of this record.
        await (agentHostId === undefined
          ? models.login(providerId, type, interaction)
          : models.login(providerId, type, interaction, {
            getDeviceId: () => agentHostId,
            agentName: APP_IDENTITY.product,
          }))
      },
    })
  }
}
