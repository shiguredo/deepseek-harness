/**
 * Provider routes this adapter ships knowledge of that pi-ai's installed
 * catalog does not describe.
 *
 * pi-ai's catalog is the authoritative answer for every provider it ships, and
 * a route it describes keeps using that answer. A provider pi-ai has never
 * heard of gets nothing from it, which leaves facts configuration cannot
 * recover on its own: the endpoint, each model's capacities, and its reasoning
 * levels. Without them such a route falls back to the adapter's generic
 * defaults — a context window that under-reports a much larger model, and no
 * reasoning levels at all — because a model listing reports neither, and
 * neither is a deployment's choice.
 *
 * This is catalog *data*, not a pi-ai `Provider`: nothing here is executed, and
 * no bundled route carries a login. It answers the same questions
 * {@link catalogModels} answers for an installed route, so every consumer keeps
 * one resolution path. A model this catalog does not name still resolves from
 * its own configuration against the route's `defaultContextWindow` and
 * `defaultMaxTokens`, exactly as a hand-declared route always has, and a route
 * a deployment repoints at another protocol keeps using its configuration.
 *
 * @module dsh-llm-pi-ai/bundled-catalog
 */

import type { Api, Model, ModelCost, ModelThinkingLevel, ThinkingLevelMap } from '@earendil-works/pi-ai'

/**
 * The reasoning levels a bundled model may offer, in pi-ai's escalation order.
 *
 * A model's `/api/show` entry reports a narrower set, but that set describes
 * the level the model likes rather than what a request may name: the endpoint
 * accepts every level here on every reasoning model and maps each onto that
 * model's own thinking budget, so offering only the reported subset would
 * withhold levels that measurably change how much the model thinks.
 */
const REASONING_LEVELS: readonly ModelThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

/**
 * The wire value that stops a model whose endpoint honours it. Ollama's
 * reasoning parameter is `none` rather than an absent field, because omitting
 * it selects the model's own default — which is thinking for every model here.
 */
const OFF_WIRE_VALUE = 'none'

/**
 * The thinking-level map for one reasoning model.
 *
 * Every level carries its own wire spelling and every level the model cannot be
 * asked for is pinned to `null`, because pi-ai's own defaulting is asymmetric —
 * an absent key means "supported" for the five base levels but "unsupported"
 * for `xhigh`/`max`. `off` is the one level with a model-dependent answer: a
 * model whose endpoint keeps reasoning whatever it is asked declares `off:
 * null`, which both withholds the level and makes pi-ai drop the reasoning
 * field entirely, so the control never claims something the model does not do.
 *
 * The pinned null matters beyond the control: pi-ai renders the reasoning field
 * from this map when a request names no level, so a model with a working `off`
 * sends the value that suppresses thinking and one without it sends nothing.
 * @param supportsOff - whether asking this model for `off` actually stops it from reasoning.
 * @returns the map pi-ai's level selection and request rendering read.
 */
function reasoningLevels(supportsOff: boolean): ThinkingLevelMap {
  const map: ThinkingLevelMap = {}
  for (const level of REASONING_LEVELS) {
    if (level !== 'off') map[level] = level
  }
  map.off = supportsOff ? OFF_WIRE_VALUE : null
  return map
}

/** One bundled model: the facts no endpoint reports about itself. */
export interface BundledModel {
  /** Model id sent to the provider and accepted by configuration. */
  readonly id: string
  /** Display name for selectors. */
  readonly name: string
  /** Maximum combined request and response context in tokens. */
  readonly contextWindow: number
  /**
   * Output cap for the model: the value a request that names no `max_tokens`
   * is sent with, and the capability a configuration entry of the same id
   * inherits. It never exceeds what the endpoint accepts, because it rejects a
   * larger value outright and the session could then never complete another
   * request.
   */
  readonly maxTokens: number
  /** Request modalities the model accepts. */
  readonly input: readonly ('text' | 'image')[]
  /** Whether the model produces reasoning output. */
  readonly reasoning: boolean
  /** Whether asking for `off` stops this model from reasoning; only meaningful when {@link reasoning}. */
  readonly supportsOff: boolean
}

/** One bundled provider route and the models it serves. */
export interface BundledProvider {
  /** Provider route key, matching the settings dict key. */
  readonly id: string
  /** Display name for selectors and configuration surfaces. */
  readonly name: string
  /** Endpoint every model on the route is served from, unless a profile repoints it. */
  readonly baseURL: string
  /** Wire protocol every model on the route speaks. */
  readonly api: Api
  /** The route's models, in directory order. */
  readonly models: readonly BundledModel[]
}

/**
 * Ollama Cloud.
 *
 * `contextWindow` and `input` come from `/api/show`
 * (`<architecture>.context_length` and `capabilities`). `reasoning` and
 * `supportsOff` come from the provider's own `thinking.values`, which names
 * `false` exactly when thinking can be turned off — measuring "does a reasoning
 * item come back" is not a substitute, because a model that thinks always
 * simply stops reporting the item when asked for `off` while still thinking.
 *
 * `maxTokens` is the vendor's published maximum output, not what Ollama's
 * Responses endpoint accepts: the endpoint takes `max_tokens` up to the model's
 * *context*, so its boundary is an upper bound that can exceed the real limit
 * by close to an order of magnitude. A model whose vendor document has not been
 * checked yet carries that upper bound, which is safe — the endpoint accepts it
 * — but states a capability the model does not have.
 */
const OLLAMA_CLOUD: BundledProvider = {
  id: 'ollama-cloud',
  name: 'Ollama Cloud',
  baseURL: 'https://ollama.com/v1',
  api: 'openai-responses',
  models: [
    { id: 'deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', contextWindow: 1_048_576, maxTokens: 393_216, input: ['text', 'image'], reasoning: true, supportsOff: true },
    { id: 'deepseek-v4-pro:0813', name: 'DeepSeek V4 Pro', contextWindow: 1_048_576, maxTokens: 65_536, input: ['text'], reasoning: true, supportsOff: true },
    { id: 'gemma4:31b', name: 'Gemma 4 31B', contextWindow: 262_144, maxTokens: 262_144, input: ['text', 'image'], reasoning: true, supportsOff: true },
    { id: 'glm-5.2', name: 'GLM 5.2', contextWindow: 1_048_576, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: true },
    { id: 'glm-5.3', name: 'GLM 5.3', contextWindow: 1_048_576, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: false },
    { id: 'glm-5.3-flash', name: 'GLM 5.3 Flash', contextWindow: 1_048_576, maxTokens: 131_072, input: ['text', 'image'], reasoning: true, supportsOff: false },
    { id: 'gpt-oss:120b', name: 'GPT-OSS 120B', contextWindow: 131_072, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: false },
    { id: 'gpt-oss:20b', name: 'GPT-OSS 20B', contextWindow: 131_072, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: false },
    { id: 'kimi-k2.6', name: 'Kimi K2.6', contextWindow: 262_144, maxTokens: 262_144, input: ['text', 'image'], reasoning: true, supportsOff: true },
    { id: 'kimi-k2.7-code', name: 'Kimi K2.7 Code', contextWindow: 262_144, maxTokens: 262_144, input: ['text', 'image'], reasoning: true, supportsOff: true },
    { id: 'kimi-k3', name: 'Kimi K3', contextWindow: 1_048_576, maxTokens: 1_048_576, input: ['text', 'image'], reasoning: true, supportsOff: true },
    { id: 'minimax-m2.7', name: 'MiniMax M2.7', contextWindow: 196_608, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: false },
    { id: 'minimax-m3', name: 'MiniMax M3', contextWindow: 512_000, maxTokens: 131_072, input: ['text', 'image'], reasoning: true, supportsOff: false },
    { id: 'mistral-large-3:675b', name: 'Mistral Large 3', contextWindow: 262_144, maxTokens: 262_144, input: ['text', 'image'], reasoning: false, supportsOff: false },
    { id: 'nemotron-3-nano:30b', name: 'Nemotron 3 Nano 30B', contextWindow: 262_144, maxTokens: 131_072, input: ['text'], reasoning: true, supportsOff: true },
    { id: 'nemotron-3-super', name: 'Nemotron 3 Super', contextWindow: 262_144, maxTokens: 65_536, input: ['text'], reasoning: true, supportsOff: true },
    { id: 'nemotron-3-ultra', name: 'Nemotron 3 Ultra', contextWindow: 262_144, maxTokens: 65_536, input: ['text'], reasoning: true, supportsOff: true },
  ],
}

/** Every bundled route. Configuration surfaces sort the merged catalog, so this order only fixes which routes exist. */
export const BUNDLED_PROVIDERS: readonly BundledProvider[] = [OLLAMA_CLOUD]

/** Bundled routes by id. */
const BY_ID: ReadonlyMap<string, BundledProvider> = new Map(BUNDLED_PROVIDERS.map(entry => [entry.id, entry]))

/**
 * One bundled route, when this build ships knowledge of it.
 * @param provider - provider route key.
 * @returns the bundled route, or `undefined` when nothing bundles that key.
 */
export function bundledProvider(provider: string): BundledProvider | undefined {
  return BY_ID.get(provider)
}

/**
 * The pricing stand-in for a bundled model. The harness reports no spend and
 * reads no rate, so this states the absence of a fact rather than a zero price.
 */
const NO_COST: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/**
 * One bundled model as a pi-ai `Model` descriptor, shaped like the entries
 * {@link catalogModels} returns so every consumer above resolves both the same
 * way. The provider and endpoint are stamped here rather than stored, because
 * those follow the route key configuration chose.
 * @param provider - provider route key to stamp on the model.
 * @param bundle - the bundled route the model belongs to.
 * @param entry - the bundled model entry.
 * @returns the model descriptor.
 */
export function bundledModel(provider: string, bundle: BundledProvider, entry: BundledModel): Model<Api> {
  return {
    id: entry.id,
    name: entry.name,
    api: bundle.api,
    provider,
    baseUrl: bundle.baseURL,
    reasoning: entry.reasoning,
    ...entry.reasoning ? { thinkingLevelMap: reasoningLevels(entry.supportsOff) } : {},
    input: [...entry.input],
    cost: NO_COST,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxTokens,
  }
}
