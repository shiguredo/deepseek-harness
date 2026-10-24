/**
 * Generic pi-ai-backed implementation of the Harness LLM seam.
 *
 * Each resolution produces one **immutable** snapshot — the profiles plus a
 * `Models` collection holding the `Provider` each route built — and an
 * operation captures a whole snapshot before its first `await`. A
 * configuration change builds a *new* collection rather than mutating the one
 * in use, because `Models.streamSimple()` is lazy: it resolves the provider
 * when the stream is first consumed, which is after the credential await, so a
 * mutated collection would let a request that started under one configuration
 * finish under another — or fail with a provider that no longer exists. This is
 * what makes the seam's per-step call freeze (`llm.prepareCall()`) hold all the
 * way down: switching models mid-reply takes effect on the next step, never
 * inside the one in flight.
 *
 * A route naming a credential reference still resolves it through the harness
 * seam and passes it as the request's `apiKey` option, which pi-ai treats as
 * the highest-priority auth override — that is what keeps the fail-loud
 * reference semantics. Everything that override does not cover reaches pi-ai
 * through the collection's own auth: the credential store holds the records a
 * login wrote and a refresh rotates, and the auth context answers the ambient
 * questions a provider asks while resolving. Both are stable across snapshots,
 * so a configuration change rebuilds the collection without forgetting who is
 * signed in.
 *
 * @module dsh-llm-pi-ai/adapter
 */

import type {
  Api,
  AuthContext,
  CredentialStore,
  Model,
  Models,
  ModelThinkingLevel,
  MutableModels,
  SimpleStreamOptions,
  ThinkingLevel,
} from '@earendil-works/pi-ai'
import {
  attributionHeaders,
  contentHasImage,
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
} from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  ImageAttachmentAccess,
  LlmModelInfo,
  LlmModelRouting,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  PreparedAdapterCall,
  ReasoningEffortId as ReasoningEffortIdType,
  ResolvedRetryPolicy,
  StreamChunk,
  ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { idleWatchdog, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import { catalogModels } from './catalog.ts'
import { catalogAlternateProfile } from './config.ts'
import type { ResolvedPiAiProviderProfile } from './config.ts'
import { requestImageTarget, toPiContext } from './context.ts'
import { conversationUpdates, createModels, getSupportedThinkingLevels } from './models.ts'
import { selectPeakWindow } from './peak.ts'
import { buildProvider } from './provider.ts'
import { toStreamChunks } from './stream.ts'

/**
 * Initially active declaration added to an Anthropic request whose projected
 * tools are all deferred, because Anthropic rejects a tool list without one.
 */
const ANTHROPIC_TOOL_UPDATE_PLACEHOLDER: ToolSchema = {
  name: 'DeferredToolPlaceholder',
  description: 'Reserved placeholder that keeps deferred tool loading active; never call this tool.',
  parameters: { type: 'object', properties: {} },
}

/** One resolution's frozen view: the profiles and the collection built from them. */
interface PiAiSnapshot {
  /** The resolved profiles this collection was built from, used as its identity. */
  profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile>
  /** Providers for every configured profile, plus every catalog provider a peak window names. */
  models: Models
  /** Execution profiles for peak candidates resolved from the installed catalog, by provider id. */
  alternates: ReadonlyMap<string, ResolvedPiAiProviderProfile>
}

/** One request's effective route after peak substitution. */
interface EffectiveRoute {
  /** Provider id whose provider entry serves the request. */
  provider: string
  /** The model descriptor to dispatch. */
  model: Model<Api>
  /** The profile supplying stream knobs and the reasoning default. */
  profile: ResolvedPiAiProviderProfile
  /**
   * Credential reference the request resolves: the window candidate's own when
   * it names one, else the credential of the configured route that candidate
   * names. Absent only when neither exists, which leaves pi-ai's
   * provider-native ambient discovery in charge.
   */
  apiKeyEnv?: CredentialRef
}

/** Constructor options for {@link PiAiAdapter}: the two resolution hooks the plugin owns. */
export interface PiAiAdapterOptions {
  /** Current validated profiles by provider route; called once per operation. */
  profiles: () => ReadonlyMap<string, ResolvedPiAiProviderProfile>
  /**
   * Resolve the credential for one already-resolved profile; called once per
   * stream call and frozen for that call, and by `listModels`, which offers no
   * models while it throws `MISSING_CREDENTIAL`. `undefined` defers to the route's own
   * pi-ai auth, which for an installed catalog route is its provider-native
   * ambient discovery; the plugin allows that only for a profile naming no
   * credential at all, because a named reference that misses throws `LlmError`
   * `MISSING_CREDENTIAL` rather than falling back.
   */
  resolveApiKey: (provider: string, apiKeyEnv: CredentialRef | undefined) => Promise<string | undefined>
  /** Clock the peak windows read; defaults to `Date.now`. */
  now?: () => number
  /**
   * How every collection this adapter builds resolves auth the request-level
   * `apiKey` override does not cover. Required rather than optional: a
   * collection built without them gets pi-ai's in-memory default store, which
   * is empty at every boot and discarded on every configuration change, so a
   * route whose only method is a login would report itself unconfigured on
   * every request no matter how often the human signed in.
   */
  auth: PiAiAuthInjection
  /** Resolve the optional durable attachment service at request time. */
  resolveAttachments?: () => AttachmentStore | undefined
  /** Bridge one attachment reference into the current model-tool execution world. */
  resolveImageAccess?: (attachments: AttachmentStore, ref: ImageAttachmentRef) => ImageAttachmentAccess | undefined
  /**
   * Observe one assistant history message degrading to provider-neutral
   * conversion because its stored replay state is unusable by this build.
   */
  onReplayDegrade?: (detail: { provider: string; model: string; reason: string }) => void
}

/** The routing declaration one profile's peak windows expose to selectors. */
function routingOf(profile: ResolvedPiAiProviderProfile, model: string): LlmModelRouting | undefined {
  const windows = profile.peak.get(model)
  if (windows === undefined) return undefined
  return {
    windows: windows.map((window) => {
      // Configuration refused an empty window, and the first candidate serves
      // every request; that is the provider a selector names for the window.
      // oxlint-disable-next-line typescript/no-non-null-assertion -- validation guarantees a first candidate
      const { provider, model: alternate } = window.providers[0]!
      return {
        from: window.from,
        to: window.to,
        provider,
        ...alternate === undefined || alternate.length === 0 ? {} : { model: alternate },
        ...window.timeZone === undefined ? {} : { timeZone: window.timeZone },
        ...window.days === undefined || window.days.length === 0 ? {} : { days: window.days },
      }
    }),
  }
}

/** The two auth injectables a pi-ai collection is built with. */
export interface PiAiAuthInjection {
  /** Durable storage for credentials pi-ai itself writes: logins, and the refreshes it runs under its own lock. */
  credentials: CredentialStore
  /** Ambient lookups a provider performs while resolving its own auth. */
  authContext: AuthContext
}

/** Copy profile stream knobs into pi-ai's common option vocabulary. */
function profileOptions(
  profile: ResolvedPiAiProviderProfile,
  reasoning: ModelThinkingLevel | undefined,
  apiKey: string | undefined,
): SimpleStreamOptions {
  const enabledReasoning: ThinkingLevel | undefined = reasoning === 'off' ? undefined : reasoning
  return {
    ...apiKey === undefined ? {} : { apiKey },
    ...enabledReasoning === undefined ? {} : { reasoning: enabledReasoning },
    ...profile.thinkingBudgets === undefined ? {} : { thinkingBudgets: profile.thinkingBudgets },
    ...profile.cacheRetention === undefined ? {} : { cacheRetention: profile.cacheRetention },
    ...profile.transport === undefined ? {} : { transport: profile.transport },
    ...profile.timeoutMs === undefined ? {} : { timeoutMs: profile.timeoutMs },
    ...profile.websocketConnectTimeoutMs === undefined ? {} : { websocketConnectTimeoutMs: profile.websocketConnectTimeoutMs },
    // The agent recovery layer owns visible attempts; one adapter call is one SDK attempt.
    maxRetries: 0,
  }
}

/**
 * The profile default this exact model can actually take, for DESCRIBING it.
 * A configured level the model does not support yields none rather than
 * throwing: `resolveModel` builds the model catalog, and a catalog that fails
 * takes its whole provider out of every picker — so one mis-set profile field
 * would hide every model on the route, including the ones that support the
 * level. The request path still refuses, which is where a bad configuration
 * belongs: describing what a model can do must not fail because a deployment
 * asked it for something it cannot.
 * @param model - the resolved model descriptor.
 * @param effort - the profile's configured level, if any.
 * @returns the level when this model supports it, otherwise undefined.
 */
function describableReasoningLevel(
  model: Model<Api>,
  effort: ReasoningEffortIdType | ModelThinkingLevel | undefined,
): ModelThinkingLevel | undefined {
  if (effort === undefined) return undefined
  return getSupportedThinkingLevels(model).some(level => level === effort)
    ? effort as ModelThinkingLevel
    : undefined
}

/** Validate an explicit Harness/profile effort without invoking pi-ai's clamp. */
function resolveReasoningLevel(
  model: Model<Api>,
  effort: ReasoningEffortIdType | ModelThinkingLevel | undefined,
): ModelThinkingLevel | undefined {
  if (effort === undefined) return undefined
  const supported = getSupportedThinkingLevels(model)
  if (supported.some(level => level === effort)) return effort as ModelThinkingLevel
  throw new LlmError(
    `pi-ai provider "${model.provider}" model "${model.id}" does not support reasoning effort "${effort}"`,
    'UNSUPPORTED_REASONING_EFFORT',
  )
}

/**
 * Selectable reasoning efforts for one model, or nothing at all.
 *
 * A model that carries no reasoning metadata — every hand-declared one, and
 * every catalog model pi-ai marks as non-reasoning — is reported by pi-ai as
 * supporting the single level `off`. Passing that through would offer a control
 * that cannot do what it says: `off` is translated to *omitting* the reasoning
 * option, which for such a model is byte-for-byte the same request as naming no
 * effort — so a provider whose own default is to think would keep thinking with
 * `off` selected. Omitting `reasoning` entirely is the seam's way of saying the
 * capability is unavailable, which leaves the surface offering only the
 * provider's default.
 * @param model - the resolved model descriptor.
 * @param defaultLevel - the profile's configured effort, already validated.
 * @returns the `reasoning` field, or an empty object when none can be offered.
 */
function reasoningInfo(
  model: Model<Api>,
  defaultLevel: ModelThinkingLevel | undefined,
): Pick<LlmResolvedModelInfo, 'reasoning'> | Record<string, never> {
  if (!model.reasoning) return {}
  const levels = getSupportedThinkingLevels(model)
  return {
    reasoning: {
      efforts: levels.map(level => ({
        id: ReasoningEffortId(level),
        name: `${level.charAt(0).toUpperCase()}${level.slice(1)}`,
      })),
      ...defaultLevel === undefined ? {} : { defaultEffort: ReasoningEffortId(defaultLevel) },
    },
  }
}

/** Merge deployment headers while removing case-insensitive attribution collisions. */
function requestHeaders(headers: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const attribution = attributionHeaders()
  const reserved = new Set(Object.keys(attribution).map(name => name.toLowerCase()))
  return {
    ...Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => !reserved.has(name.toLowerCase()))),
    ...attribution,
  }
}

/**
 * pi-ai-backed multi-provider adapter. Each operation reads the current
 * profiles, so a configuration change reaches the next request without a
 * restart; model descriptors come from the collection those profiles built.
 */
export class PiAiAdapter extends LlmAdapter {
  private snapshot: PiAiSnapshot | undefined

  constructor(private readonly config: PiAiAdapterOptions) {
    super()
  }

  override imageRequestTarget(provider: string, model: string, image: ImageAttachmentRef) {
    const snapshot = this.current()
    this.modelOf(snapshot, provider, model)
    const profile = this.profileOf(snapshot, provider)
    return requestImageTarget(image, { maxPixels: profile.requestImagePixelBudget, maxBytes: profile.requestImageMaxBytes })
  }

  /**
   * The snapshot for the current profiles. Resolution memoizes its result, so
   * an unchanged configuration is recognized by identity; a changed one gets a
   * brand-new collection, leaving any snapshot an operation already captured
   * untouched for as long as that operation holds it.
   */
  private current(): PiAiSnapshot {
    const profiles = this.config.profiles()
    if (this.snapshot?.profiles === profiles) return this.snapshot
    const models: MutableModels = createModels(this.config.auth)
    for (const profile of profiles.values()) {
      if (profile.piProvider !== undefined) models.setProvider(profile.piProvider)
    }
    const alternates = new Map<string, ResolvedPiAiProviderProfile>()
    for (const profile of profiles.values()) {
      for (const windows of profile.peak.values()) {
        for (const window of windows) {
          for (const candidate of window.providers) {
            if (profiles.has(candidate.provider) || alternates.has(candidate.provider)) continue
            // Configuration refused a candidate the installed catalog does not
            // describe, and the catalog is fixed for the process's lifetime.
            const built = buildProvider({
              provider: candidate.provider,
              displayName: candidate.provider,
              models: [...catalogModels(candidate.provider).values()],
              namesCredential: candidate.apiKeyEnv !== undefined,
            })
            models.setProvider(built)
            alternates.set(candidate.provider, catalogAlternateProfile(candidate.provider, built))
          }
        }
      }
    }
    this.snapshot = { profiles, models, alternates }
    return this.snapshot
  }

  /** The clock the peak windows read. */
  private now(): number {
    return this.config.now?.() ?? Date.now()
  }

  /** The profile for one route within one snapshot, or the not-owned failure. */
  private profileOf(snapshot: PiAiSnapshot, provider: string): ResolvedPiAiProviderProfile {
    const profile = snapshot.profiles.get(provider)
    if (profile === undefined) {
      throw new LlmError(`pi-ai adapter does not own provider "${provider}"`, 'NO_ADAPTER')
    }
    return profile
  }

  /** The configured descriptor for one exact route/model pair within one snapshot. */
  private modelOf(snapshot: PiAiSnapshot, provider: string, model: string): Model<Api> {
    const profile = this.profileOf(snapshot, provider)
    const failure = profile.modelErrors.get(model)
      ?? (profile.piProvider === undefined ? profile.catalogError : undefined)
    if (failure !== undefined) throw new LlmError(failure, 'INVALID_CONFIG')
    const resolved = snapshot.models.getModel(provider, model)
    if (resolved === undefined) {
      throw new LlmError(`pi-ai provider "${provider}" has no configured model "${model}"`, 'UNKNOWN_MODEL')
    }
    return resolved
  }

  /**
   * The route one request actually uses: the configured route, or the first
   * candidate of the first peak window containing `now` that serves the
   * model. Configuration refuses a candidate the catalog does not describe, so
   * the fall-through below only protects an already-published snapshot.
   * @param snapshot - the frozen resolution.
   * @param provider - the configured route the request named.
   * @param model - the model id.
   * @param now - epoch milliseconds of the request.
   * @returns the provider, model descriptor, profile, and credential reference to execute.
   */
  private routeFor(snapshot: PiAiSnapshot, provider: string, model: string, now: number): EffectiveRoute {
    const primary = this.profileOf(snapshot, provider)
    const windows = primary.peak.get(model)
    const window = windows === undefined ? undefined : selectPeakWindow(windows, now)
    if (window !== undefined) {
      // Configuration refused an empty window and a candidate the installed
      // catalog does not describe or which does not serve the model it names,
      // and `current()` registered into this snapshot every candidate it
      // accepted.
      // oxlint-disable-next-line typescript/no-non-null-assertion -- validation guarantees a first candidate
      const candidate = window.providers[0]!
      // A candidate may name another model of its provider; omission keeps the
      // routed model's own id.
      const served = candidate.model === undefined || candidate.model.length === 0 ? model : candidate.model
      // oxlint-disable-next-line typescript/no-non-null-assertion -- validation and registration guarantee both
      const descriptor = snapshot.models.getModel(candidate.provider, served)!
      const configured = snapshot.profiles.get(candidate.provider)
      const profile = configured
        // oxlint-disable-next-line typescript/no-non-null-assertion -- an unconfigured candidate has a synthetic profile
        ?? snapshot.alternates.get(candidate.provider)!
      // The window switches the endpoint, not how the route it names
      // authenticates: that route's own reference applies unless the window
      // names one, which is what keeps a candidate that is a configured route
      // usable without repeating its credential in every window. An
      // installed-catalog alternate has no route profile, so omission there
      // keeps pi-ai's provider-native ambient discovery.
      const apiKeyEnv = candidate.apiKeyEnv === undefined
        ? configured?.apiKeyEnv
        : credentialRef(candidate.apiKeyEnv)
      return {
        provider: candidate.provider,
        model: descriptor,
        profile,
        ...apiKeyEnv === undefined ? {} : { apiKeyEnv },
      }
    }
    return {
      provider,
      model: this.modelOf(snapshot, provider, model),
      profile: primary,
      ...primary.apiKeyEnv === undefined ? {} : { apiKeyEnv: primary.apiKeyEnv },
    }
  }

  override providerInfo(provider: string): LlmProviderInfo {
    // The configured name, not the route key: `displayName` exists so a
    // deployment can label a route, and a label only the configuration surface
    // reads would leave every selector showing the raw key.
    return { id: provider, name: this.current().profiles.get(provider)?.displayName ?? provider }
  }

  override providerRetryPolicy(provider: string): ResolvedRetryPolicy | undefined {
    return this.current().profiles.get(provider)?.retryPolicy
  }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve().then(async () => {
      const snapshot = this.current()
      const profile = this.profileOf(snapshot, provider)
      try { await this.config.resolveApiKey(provider, profile.apiKeyEnv) }
      catch (error) {
        // A route whose named key does not resolve cannot serve a request, so it offers no models until the key is stored.
        if (error instanceof LlmError && error.code === 'MISSING_CREDENTIAL') return []
        throw error
      }
      return snapshot.models.getModels(provider).map((model) => {
        const routing = routingOf(profile, model.id)
        return {
          provider,
          id: model.id,
          name: model.name,
          inputModalities: [...model.input],
          ...routing === undefined ? {} : { routing },
        }
      })
    })
  }

  override resolveModel(
    provider: string,
    model: string,
    _signal?: AbortSignal,
  ): Promise<LlmResolvedModelInfo> {
    return Promise.resolve().then(() => {
      const snapshot = this.current()
      return this.modelInfo(snapshot, provider, model)
    })
  }

  /**
   * Describe one execution route. The reported provider is always the route the
   * request named, so the session log keeps its stable identity; capacities and
   * reasoning levels come from the descriptor actually dispatched.
   */
  private describe(
    provider: string,
    model: string,
    descriptor: Model<Api>,
    profile: ResolvedPiAiProviderProfile,
    configuredMaxTokens: number | undefined,
    routing: LlmModelRouting | undefined,
  ): LlmResolvedModelInfo {
    const defaultLevel = describableReasoningLevel(descriptor, profile.reasoning)
    return {
      provider,
      id: model,
      name: descriptor.name,
      inputModalities: [...descriptor.input],
      ...routing === undefined ? {} : { routing },
      context: { contextWindow: descriptor.contextWindow },
      ...configuredMaxTokens === undefined ? {} : { defaultMaxTokens: configuredMaxTokens },
      ...reasoningInfo(descriptor, defaultLevel),
      ...conversationUpdates(descriptor),
    }
  }

  private modelInfo(snapshot: PiAiSnapshot, provider: string, model: string): LlmResolvedModelInfo {
    const profile = this.profileOf(snapshot, provider)
    // Only a cap the deployment configured is a request default; the
    // catalog's `maxTokens` sizes the model and stops there.
    return this.describe(
      provider,
      model,
      this.modelOf(snapshot, provider, model),
      profile,
      profile.configuredMaxTokens.get(model),
      routingOf(profile, model),
    )
  }

  override prepareCall(provider: string, model: string, _signal?: AbortSignal): Promise<PreparedAdapterCall> {
    const snapshot = this.current()
    const effective = this.routeFor(snapshot, provider, model, this.now())
    const primary = this.profileOf(snapshot, provider)
    return Promise.resolve({
      model: this.describe(
        provider,
        model,
        effective.model,
        effective.profile,
        primary.configuredMaxTokens.get(model),
        routingOf(primary, model),
      ),
      stream: options => this.streamWithSnapshot(options, snapshot, effective),
    })
  }

  stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const snapshot = this.current()
    return this.streamWithSnapshot(options, snapshot, this.routeFor(snapshot, options.provider, options.model, this.now()))
  }

  private async * streamWithSnapshot(
    options: GenerateOptions,
    snapshot: PiAiSnapshot,
    effective: EffectiveRoute,
  ): AsyncIterable<StreamChunk> {
    if (options.stop !== undefined) {
      throw new LlmError('llm-pi-ai does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')
    }
    // One capture per stream call, taken before any await: the profile, the
    // model descriptor, and the collection all come from the same immutable
    // snapshot, and the credential freezes with them. A configuration change
    // mid-request builds a separate snapshot, so this request finishes under
    // the one it started with and the next call picks up the new one.
    const profile = effective.profile
    const model = effective.model
    const updates = conversationUpdates(model)
    // pi-ai collapses Anthropic tool updates without an initially active declaration.
    const tools = options.tools ?? []
    const needsPlaceholder = model.api === 'anthropic-messages' && updates.toolUpdate === 'in-history'
      && tools.every(tool => tool.deferLoading === true)
      && options.messages.some(message => message.role === 'developer'
        && message.content.some(block => block.type === 'tool-addition' || block.type === 'tool-removal'))
    const request = needsPlaceholder
      ? { ...options, tools: [ANTHROPIC_TOOL_UPDATE_PLACEHOLDER, ...tools] }
      : options
    const reasoning = resolveReasoningLevel(
      model,
      options.reasoningEffort ?? profile.reasoning,
    )
    const apiKey = await this.config.resolveApiKey(effective.provider, effective.apiKeyEnv)

    const consumer = new AbortController()
    const upstream = options.signal === undefined
      ? consumer.signal
      : AbortSignal.any([options.signal, consumer.signal])
    const streamIdleTimeoutMs = profile.streamIdleTimeoutMs
    using watchdog = idleWatchdog(upstream, streamIdleTimeoutMs, 'LLM_STREAM_IDLE_TIMEOUT')

    try {
      const containsImage = options.messages.some(message => contentHasImage(message.content))
      if (containsImage && !model.input.includes('image')) {
        throw new LlmError(`pi-ai model "${model.id}" does not support image input`, 'UNSUPPORTED_CONTENT')
      }
      const attachments = containsImage ? this.config.resolveAttachments?.() : undefined
      if (containsImage && attachments === undefined) {
        throw new LlmError('pi-ai image input requires the durable attachment service', 'UNSUPPORTED_CONTENT')
      }
      const onReplayDegrade = (reason: string): void => {
        this.config.onReplayDegrade?.({ provider: options.provider, model: options.model, reason })
      }
      const context = attachments === undefined
        ? toPiContext(request, undefined, onReplayDegrade, updates.systemPromptUpdate === 'in-history')
        : await toPiContext({ ...request, signal: watchdog.signal }, {
          attachments,
          resolveImageAccess: ref => this.config.resolveImageAccess?.(attachments, ref),
          maxRequestImageBytes: profile.maxRequestImageBytes,
          requestImagePolicy: {
            maxPixels: profile.requestImagePixelBudget,
            maxBytes: profile.requestImageMaxBytes,
          },
        }, onReplayDegrade, updates.systemPromptUpdate === 'in-history')
      const events = snapshot.models.streamSimple(model, context, {
        ...profileOptions(profile, reasoning, apiKey),
        ...options.temperature === undefined ? {} : { temperature: options.temperature },
        ...options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens },
        ...options.sessionId === undefined ? {} : { sessionId: String(options.sessionId) },
        signal: watchdog.signal,
        // Profile headers are deployment-owned; attribution names are
        // Harness-owned and therefore win collisions.
        headers: requestHeaders(profile.headers),
      })
      const iterator = toStreamChunks(events, model.contextWindow, options.signal, model.id)[Symbol.asyncIterator]()
      let exhausted = false
      try {
        while (true) {
          const result = await watchdog.next(iterator)
          if (result.done) {
            exhausted = true
            return
          }
          yield result.value
        }
      } finally {
        if (!exhausted) {
          consumer.abort('pi-ai stream consumer stopped')
          // A demand the deadline abandoned can stay pending forever, and this
          // generator queues its return behind it; the abort above owns SDK termination.
          /* v8 ignore next -- the detached drain only rejects while unwinding an abandoned stream. */
          void iterator.return(undefined).catch(() => {})
        }
      }
    } catch (error: unknown) {
      if (timeoutOf(watchdog.signal, 'LLM_STREAM_IDLE_TIMEOUT') !== undefined) {
        throw new LlmError(`pi-ai stream idle timeout after ${streamIdleTimeoutMs}ms`, 'TIMEOUT', { cause: error })
      }
      if (options.signal?.aborted) {
        throw new LlmError('pi-ai request aborted by caller', 'ABORTED', { cause: error })
      }
      throw error
    } finally {
      consumer.abort('pi-ai stream consumer stopped')
    }
  }
}
