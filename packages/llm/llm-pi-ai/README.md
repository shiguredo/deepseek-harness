---
description: "The pi-ai-backed multi-provider adapter for users and maintainers routing the harness LLM service through pi-ai catalogs and hand-declared gateways."
kind: "package-reference"
---

# @deepseek-ai/dsh-llm-pi-ai

English | [中文](README.zh.md)

## Summary

`@deepseek-ai/dsh-llm-pi-ai` routes model requests to multiple pi-ai providers, OpenAI-compatible gateways, or self-hosted servers from one configuration. Installed pi-ai providers supply endpoint, protocol, and catalog defaults, and this build also bundles the routes pi-ai does not ship (Ollama Cloud); custom routes declare those values themselves. Profiles, credentials, and per-model peak destinations resolve per request, so settings changes take effect on the next request without a restart. Supported providers can use stored OAuth or interactive-key sign-in with cross-process refresh locking. The package may start with no routes and activate when user settings add them.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin when a composition routes model requests through pi-ai's provider catalogs or through gateways that pi-ai's installed catalog does not describe. The `providers` dictionary is the whole configuration surface: each key is the provider route name a request selects with `GenerateOptions.provider`.

The adapter accepts the LLM service's [request-only user inputs](../llm/README.md#use-this-package) alongside durable history. User identity and attribution do not enter pi-ai content; assistant replay metadata and tool-call correlation remain attached to durable messages.

### When to choose it

Choose this adapter when the same composition serves several providers, when a route needs pi-ai's catalog defaults with a few fields corrected, or when a hand-declared gateway must be reached through its own endpoint and protocol. Choose `dsh-llm-deepseek` for the direct DeepSeek route when the deployment needs no other provider. Both adapters can be mounted together because their route names do not collide; registering a route another adapter already owns fails plugin loading.

### Routes this build bundles

pi-ai's installed catalog is the authoritative answer for every provider it ships, and a route it names uses that answer. A provider pi-ai has never heard of gets nothing from it, which is why this build bundles **Ollama Cloud** (`ollama-cloud`): a profile naming only a credential resolves `https://ollama.com/v1`, the OpenAI Responses protocol, and the service's models with their real context windows, output caps, input modalities, and reasoning levels. The route key is the cloud service's; a local Ollama server stays a hand-declared route under whatever id the deployment gives it. Nothing about the bundled route needs configuration, and nothing about it is hardcoded against a profile: naming `baseURL`, `api`, `models`, or `modelOverrides` still wins field by field, so repointing the route at a proxy or correcting one capacity works exactly as it does on a catalog route. A model the bundle does not name resolves from the route's `defaultContextWindow` and `defaultMaxTokens` like any hand-declared entry. Selectors show the bundled product name where a profile names none.

Reasoning levels on a bundled route come from the bundle rather than from configuration. A model whose endpoint keeps thinking whatever it is asked offers no `off` level, so a selector never presents a setting the provider ignores. Every level carries its own wire spelling, and `off` is sent as the parameter value that suppresses thinking rather than as an omitted field.

### Configure provider routes

Each profile may set a `retryPolicy`; omission uses normal mode with five retries. `apiKeyEnv` is a credential reference resolved per request through the harness credential seam, so no secret enters the configuration file; a reference that resolves to nothing fails the request with `MISSING_CREDENTIAL`. Omitting it leaves the route configured-but-keyless, which for an installed catalog route defers to pi-ai's provider-native ambient discovery.

```yaml
- name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      openai:
        apiKeyEnv: OPENAI_API_KEY
        baseURL: https://proxy.example.com:8443
        reasoning: high
        requestImagePixelBudget: 4194304 # total pixels; 2048 by 2048 default
        requestImageMaxBytes: 1048576    # raw bytes before base64 expansion
        maxRequestImageBytes: 20971520   # accumulated base64 payload
        retryPolicy:
          mode: normal
          maxRetries: 3
      anthropic:
        apiKeyEnv: ANTHROPIC_API_KEY
        models:
          - id: claude-sonnet-4-5
            contextWindow: 200000
      acme-gateway:
        displayName: Acme Gateway
        apiKeyEnv: ACME_GATEWAY_API_KEY
        api: openai-completions
        baseURL: https://gateway.acme.example/v1
        compat:
          thinkingFormat: deepseek
        models:
          - id: acme-think
            name: Acme Think
            contextWindow: 262144
            reasoningEfforts:
              off:
              high: high
```

| Field | Default | Meaning |
|---|---|---|
| `apiKeyEnv` | absent | Credential reference resolved per request; omission defers to pi-ai ambient discovery |
| `displayName` | provider name | Label shown by selector surfaces |
| `api` | catalog protocol | Wire protocol; only needed for routes the catalog does not supply |
| `baseURL` | catalog endpoint | Endpoint of every model on the route |
| `models` | installed catalog | Replaces the route's catalog wholesale; each entry defaults from the installed model |
| `modelOverrides` | none | Reshapes individual installed-catalog models without replacing the rest |
| `compat` | catalog detection | Wire-compatibility switches for unrecognized endpoints |
| `defaultContextWindow` | `1,000,000` | Capacity fallback for undescribed models |
| `defaultMaxTokens` | `128,000` | Output-cap fallback for undescribed models |
| `requestImagePixelBudget` | `4,194,304` | Total-pixel budget for each deterministic request image |
| `requestImageMaxBytes` | `1 MiB` | Encoded-byte target for each request image before base64 expansion |
| `maxRequestImageBytes` | `20 MiB` | Aggregate base64 image-payload bound; a request whose retained images exceed it fails with `IMAGE_OFFLOAD_REQUIRED` |
| `retryPolicy` | normal, 5 retries | Provider-owned retry policy executed by `dsh-llm-retry` |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-llm-pi-ai) is the exhaustive source for every accepted field and its JSDoc.

### Sign in to a provider

A provider pi-ai ships a login for can be signed into through the harness authorization seam: the flow offers OAuth or an interactive key prompt (a key is typed into pi-ai's own login prompt, not into the settings form), and the resulting credential is stored in the harness credential store at `llm-pi-ai/<provider id>`. The stored sign-in authenticates its route beneath any `apiKeyEnv` override and refreshes itself under the store's cross-process lock; signing out deletes the stored record. A hand-declared route key outside the record grammar — a lowercase hyphenated identifier — cannot be signed into, because a record write for it refuses with `LlmError('UNSTORABLE_PROVIDER_ID')`; such a route authenticates through `apiKeyEnv` or ambient provider settings instead.

### Resolve the model catalog

A profile's `models` list replaces the route's installed catalog rather than extending it; each entry defaults its unset fields from the installed model of the same id, so narrowing a route to two models, correcting one capacity, or adding a model newer than the installed catalog are one-line edits. `modelOverrides` reshapes individual installed-catalog models without that cost — correct one model, keep the other thirty-seven — and is refused when set beside a `models` list, on a hand-declared route, or naming a model the catalog does not describe, because a silently unchanged model would be a typo someone hunts for later.

A bundled entry may also carry the release marking its provider publishes: `deepseek-v4.1-flash:1017` shows `1017` beside DeepSeek's own name, because the pinned tag is what separates that build from a later one served under the same name. `listModels` advertises the badge with the rest of the entry, so the composer draws it from the catalog the way it draws a listed model's badge; no model request and no Session event carries it. A deployment's own `models` entry declares no badge, because only the catalog that owns the marking states it.

### Switch providers during published peak hours

A `models` entry may declare `peak`: the destinations the model's requests go to during its published peak window. The period is the provider's price policy rather than a deployment preference, so it ships with the catalog data of the models that publish an off-peak rate, and configuration names only where requests go meanwhile. Ollama Cloud prices `deepseek-v4.1-flash:1017` and `deepseek-v4-pro:0813` at peak from 12:00 to 18:00 UTC on weekdays, and at the off-peak rate at every other hour and all weekend.

```yaml
providers:
  ollama-cloud:
    apiKeyEnv: OLLAMA_CLOUD_API_KEY
    models:
      - id: deepseek-v4.1-flash:1017
        peak:
          - provider: opencode-go
            model: kimi-k3
            apiKeyEnv: OPENCODE_GO_API_KEY
```

The route keeps its own provider, endpoint, and display name, so the Session log and every selector keep one stable identity while the wire request follows the window.

Destinations are tried in configuration order and the first that serves the model is used. A destination resolves from the installed catalog, so one this build bundles or a deployment declares, or one that does not serve the model it will receive, is refused at load. That model is the destination's own `model` when it names one and the routed model's id otherwise, so a window may move the request to another model of the same provider or of another one. A destination's `apiKeyEnv` is resolved per request exactly as a route's own is; one that is also a configured route keeps that route's credential when the destination names none, while a catalog-only one defers to pi-ai's provider-native ambient discovery.

Declaring `peak` on a model this build ships no window for is refused at load, because a period configuration cannot answer is a routing rule that would never fire. A stored entry that still carries a period from an earlier shape is read for its destination, and the shipped period wins.

The reported identity does not change: the configured provider, model id, reasoning effort, and the Session log stay as selected, while the wire request goes to the candidate the window names — that candidate's model when it names one, otherwise the routed model's own id — and the capacities come from the descriptor the catalog holds for it. An operator who needs the backend that physically served a request reads that provider's own records. The model catalog advertises the windows, so a selector can mark the model while one is active.

### Run with reasoning and wire compatibility

`reasoningEfforts` declares a model's selectable thinking levels: each key is a level selectors offer, its value the spelling dispatch sends on the wire, so `max: ultra` renames a level for a gateway with its own vocabulary. Omitting the field keeps the installed catalog entry's capability; `false` declares a non-reasoning model. `compat` switches reshape the request for endpoints pi-ai cannot recognize — which role carries the system prompt, which field caps output, how a thinking level travels — configurable per route and per model. A model neither the entry nor the installed catalog sizes takes the route's `defaultContextWindow` and `defaultMaxTokens` fallbacks.

Exact-model metadata lists `reasoning.efforts` from least to greatest selectable effort. A configuration function can select from that list before `prepareCall()` validates the concrete effort. The adapter receives only the resolved controls. Selecting `off` does not guarantee disabled reasoning: a protocol that expresses it by omitting the reasoning field leaves the gateway's default in effect. Reasoning tokens at any selected level count toward the request's output cap.

For self-hosted Chat Completions endpoints, `thinkingTokenBudgetField` selects the reasoning-budget parameter, and `vllmPriority` sets an integer scheduler priority when the server enables priority scheduling. Template arguments accept `$var: thinking.budget`. `openai-responses` gateways can set `supportsMaxOutputTokens: false` to omit `max_output_tokens`; Azure and Codex transports ignore this shared compatibility field. These controls are opt-in; catalog-owned Anthropic effort and fallback capabilities are not configurable switches.

### Change configuration at runtime

Each operation captures the current `providers` Config reference. New or changed provider profiles are validated before form persistence; unchanged catalog failures remain editable. Route-set or retry-policy changes update registration atomically, preserving previous routes if another adapter owns a requested route.

### Discover models from endpoints

The plugin answers "which models can this provider serve?" for a route a configuration surface is editing or drafting. A route the installed catalog ships — or one this build bundles — is answered from that catalog with no network call, preserving its `input` array as discovery `inputModalities`; only a route neither describes is interrogated over the wire. `openai-completions` and `openai-responses` use `GET {baseURL}/models` with bearer auth, while `anthropic-messages` uses native `GET /v1/models?limit=1000` semantics with `x-api-key` and `anthropic-version`; its listing URL accepts the API root with or without a trailing `/v1` because gateway documentation publishes both spellings, and only that listing URL normalizes the segment, so model requests receive the configured `baseURL` unchanged. A named configured route supplies its stored credential and profile `headers` inside the Host, so deployment headers configured through `cordis.patch.yml` or Cordis config reach model discovery without becoming discovery-request or Models-page fields; a key typed into the form still wins over the stored credential. The parser accepts either the standard `data` array or an enriched `models` map, normalizing each candidate's id, display name, context window, and output-token cap; Anthropic's `max_input_tokens` and `max_tokens` feed the same capacity fields, a map key remains the request id even when its entry names a different canonical id, primitive-valued map properties are ignored, and a missing display name falls back to that request id. The reply is candidate metadata a surface may offer for adoption — nothing is stored, and `cordis.patch.yml` remains the only thing that decides what a route serves.

### Failures and recovery

A route pi-ai does not ship and this build does not bundle needs `api`, `baseURL`, and a non-empty `models` list; an unserviceable profile is refused where it is written, naming the route and model. A bundled route needs none of them, and a profile that names only a credential is serviceable as written. Failures carry stable codes: a credential that cannot be used fails with `INVALID_CREDENTIAL` naming the route and reference, a route whose `apiKeyEnv` reference resolves to nothing fails with `MISSING_CREDENTIAL`, an unconfigured model fails with `UNKNOWN_MODEL`, and terminal provider failures distinguish `QUOTA` from transient `RATE_LIMIT`. `GenerateOptions.stop` is rejected with `UNSUPPORTED_OPTION` because pi-ai's common streaming UI cannot guarantee it across providers.

Config updates strictly validate changed providers. Initial loading retains stored catalog failures as editable provider diagnostics; unchanged failed providers do not block edits elsewhere. Serviceable models remain selectable, and unresolved models fail before network I/O. Repairing or deleting the offending configuration clears its diagnostic.

Changing `displayName`, `apiKeyEnv`, or `baseURL` without resolving the provider's model errors still rejects the save. For example, renaming an OpenRouter route whose model `111` needs an `api` cannot be saved on its own: repair or remove that model in the same editor draft, then save the complete provider configuration. Intermediate repairs remain in the draft until the whole provider validates; other providers can be saved independently.

Model discovery resolves each route’s credential configuration. A missing required credential yields an empty catalog; other resolution errors propagate. Routes with native authentication or no required key retain their configured catalog. This check does not probe the inference endpoint.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design behind the adapter; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The adapter is built on immutable snapshots and per-operation resolution. Each operation captures a whole snapshot — the profiles plus a `createModels()` collection holding the `Provider` each route built — before its first `await`, and a configuration change builds a new collection rather than mutating the one in use, so a request that started under one configuration never finishes under another. A route's own credential reference resolves through the harness seam and rides as the request's `apiKey` option, which pi-ai treats as the highest-priority auth override — that is what keeps the fail-loud reference semantics. Everything that override does not cover reaches pi-ai through the collection's own auth: the credential store holds the records a login wrote and a refresh rotates (addressed as `llm-pi-ai/<provider id>`), and the auth context answers the ambient questions a provider asks while resolving. Both are stable across snapshots, so a configuration change rebuilds the collection without forgetting who is signed in. Runtime imports use pi-ai's provider, API, and utility entry points; `src/models.ts` supplies the small model-helper subset this adapter needs without evaluating pi-ai's aggregate entry point.

Initial prompt text and active tools use pi-ai's `Context.systemPrompt` and `Context.tools`; later system and tool updates remain in `Context.messages`. pi-ai normalizes these fields and applies the selected protocol's serialization rules.

<a id="request-headers"></a>
### Request headers

Plugins can contribute model-hidden transport metadata through the synchronous `llm-pi-ai/request-headers` waterfall. Each inference call supplies immutable routing metadata (`PiAiRequestHeaderContext`) and a fresh `Headers` copy of its profile headers; when configured names differ only in capitalization, the last entry wins. The endpoint belongs to the prepared model, so concurrent calls and configuration changes cannot exchange header state. Listeners edit that copy, call `next()`, and release their references on return; `ctx.on()` removes their registration when the owning plugin unloads. Harness attribution is applied after all contributors, and pi-ai receives a detached header record.

This event covers inference calls with or without a Session id, including auxiliary calls, but excludes model discovery. A contributor exception or invalid HTTP header fails the call with `REQUEST_HEADERS` before inference dispatch; no partially prepared request is sent. The failure identifies the provider and includes the contributor's top-level error message, which must exclude credentials and header values. Native header validation can echo values in a `TypeError`, so TypeError details and non-Error throws receive safe guidance instead; nested causes remain attached to the thrown error but are not copied into the public failure. Contributions do not change messages, tool schemas, or the Session log. Direct `PiAiAdapter` consumers can supply the equivalent `prepareHeaders` callback.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Config snapshots, directory and route registration |
| [`src/auth.ts`](src/auth.ts) | The credential store and ambient auth context over the harness credential plane |
| [`src/login.ts`](src/login.ts) | Authorization flows for the installed providers that ship a login |
| [`src/config.ts`](src/config.ts) | Profile schema, resolution, and serviceability checks |
| [`src/catalog.ts`](src/catalog.ts) | Installed-catalog integration and drift gates |
| [`src/bundled-catalog.ts`](src/bundled-catalog.ts) | Routes this build describes that pi-ai's catalog does not |
| [`src/provider-data.ts`](src/provider-data.ts) | Generated authentication and endpoint metadata for configuration surfaces |
| [`src/models.ts`](src/models.ts) | Model collections, static providers, and reasoning levels over narrow pi-ai entry points |
| [`src/provider.ts`](src/provider.ts) | The supported-protocol table and provider construction |
| [`src/context.ts`](src/context.ts) | Harness-to-pi-ai context conversion, image handling, replay restore |
| [`src/stream.ts`](src/stream.ts) | pi-ai event conversion into harness `StreamChunk` values |
| [`src/replay.ts`](src/replay.ts) | Versioned `ReplayEnvelope` storage and validation |
| [`src/discovery.ts`](src/discovery.ts) | Endpoint interrogation for configuration surfaces |

### Registration and directory

The plugin declares every installed catalog provider it can authenticate in the configurable-provider directory, joined with every bundled route and every route the current profiles declare, so configuration surfaces can offer the full catalog before any route exists. A catalog provider whose catalog lists models but no chat model, such as one of classifier models alone, is left out and gets no sign-in flow, because this adapter dispatches chat requests only. Each entry carries `declared` — whether pi-ai ships nothing under that key — because only the adapter can distinguish a hand-declared route from a narrowed catalog route. A bundled route is not `declared`: pi-ai ships nothing for it either, but this adapter describes it, so it behaves as a shipped route rather than one a deployment invented. A catalog entry carries `defaultBaseURL` for a fixed provider endpoint or a fixed endpoint shared by all its models, `baseURLEnv` for endpoint configuration variables, and `nativeAuth` for authentication variables and OAuth availability. Different model endpoints and unresolved URL templates are not presented as one fixed default. Route registration is atomic: a candidate set that collides with another adapter leaves the previous routes serving. A bare mount with zero routes is the dormant posture: nothing registers until the Config supplies profiles, and routes drop when it empties.

<a id="generated-provider-metadata"></a>
### Generated provider metadata

[`scripts/gen-provider-data.ts`](scripts/gen-provider-data.ts) owns [`src/provider-data.generated.ts`](src/provider-data.generated.ts). It uses public resolvers with synthetic `AuthContext` answers to discover environment reads across empty, individual and suffix configurations. Resolver failures use `findEnvKeys` through the temporary compatibility entry. All current authentication variables come from resolvers; no authentication supplement is needed. The generator reports fallback use and fails if fallback metadata is missing. It does not read real credentials, start a login flow, or send a model request. Probing covers the installed resolvers; it does not prove all possible value-dependent branches.

Endpoint data comes from the public provider/model catalog and uppercase URL placeholders. Azure, Vertex and Bedrock need small supplements for variables read outside the auth context. Runtime directory reads execute no probes. The dependency range remains unchanged. A provider added by a newer consumer installation has no generated authentication hints until regeneration. For an existing provider, changed environment names and endpoints also remain at the generated snapshot until regeneration. Environment hints check only the listed credential references; they do not inspect provider-managed files such as AWS profiles or Google application-default credentials.

After updating pi-ai or changing the generator, install the updated locked dependencies, then run these commands from the repository root:

```sh
pnpm run gen-provider-data
pnpm run verify-provider-data
git add packages/llm/llm-pi-ai/src/provider-data.generated.ts
```

Review the generated diff and stage the dependency or generator changes with it. Do not edit the generated file by hand. Generation errors must be resolved before committing.

The `pre-commit` hook runs `node_modules/.bin/tsx packages/llm/llm-pi-ai/scripts/gen-provider-data.ts --check --cached` when `pnpm-lock.yaml`, this package's `package.json`, the generator, or the generated file is staged. It compares the staged generated file with expected data computed from the installed dependency and current generator. It does not rewrite files or stage them. Updating only the working file is insufficient; stage the generated file too. If the check reports stale metadata, rerun the commands above before retrying the commit. CI runs `pnpm run verify-provider-data` against the checkout and installed lockfile dependencies even when the local hook was not triggered.

### Replay and vocabulary

Successful assistant responses store a versioned, lossless-JSON replay state beside the provider and model that produced them — response-level facts plus one per-block entry per streamed block. At request time, `LlmRuntime` passes replay state only when the same adapter instance owns both routes; the adapter validates it and restores native response ids, provider signatures, and optional `providerThinkingLevel` effort metadata, keeping absent effort metadata absent. Replay validates the requested model identity against the assistant source and uses it to retain same-model signatures; provider-reported response models remain diagnostic metadata. Absent or unusable replay state degrades to provider-neutral content while preserving the assistant source’s required provider and model. pi-ai tool-call arguments are parsed objects, so the adapter parses input and re-stringifies output to the harness raw-JSON convention; pi-ai in-stream error events map to terminal `finish` chunks. Protocol conversion operates on request-local copies. Switching from A to B and back to A preserves the stored content, including empty text blocks, tool ids, original block order, and native replay metadata; requests to a different provider, API, or model omit unsupported signatures and reasoning blocks. Degraded replay without native metadata also omits reasoning. Valid native replay retains the stored reasoning when the original model resumes.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the service contract to the twin adapter and the shared types.

- [dsh-llm service](../llm/README.md) — the provider-neutral service this adapter registers on.
- [llm-deepseek adapter](../llm-deepseek/README.md) — the direct DeepSeek twin for the `deepseek-official` route.
- [LLM streaming subsystem](../../../docs/subsystems/llm-streaming.md) — the `StreamChunk` protocol and adapter contract.
- [llm-retry](../llm-retry/README.md) — the retry executor that applies each profile's `retryPolicy`.
- [Twin LLM adapters](../../../.agents/notes/implemented/architecture/2026-06-13-twin-llm-adapters.md) — why the DeepSeek route ships two structurally different adapters.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-llm-pi-ai) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

### Provider request through pi-ai

#### What the model sees

The selected catalog model receives system-message text, conversation history, tools, and supported sampling fields. The adapter preserves later system messages in history order when the catalog model declares `supportsMidConvoSystemMessages`. Otherwise, it converts each non-empty later system message to a user message wrapped in `<system-reminder>` before passing it to pi-ai. The wrapper does not grant system-role priority. One-shot `GenerateOptions.system` precedes the initial history prompt. Repeated system messages remain repeated; empty system messages are skipped without discarding earlier text. Tool-update capabilities select the shared historical declaration projection; pi-ai receives initially active tools and grouped developer updates carrying additions and supported removals. When every projected declaration of an Anthropic request with tool updates is deferred, the initially active tools are one placeholder, `DeferredToolPlaceholder`, whose description tells the model never to call it; a call reaches the ordinary unknown-tool result. Anthropic receives later tool definitions inline in the update message. Replay preserves tool-call namespaces for dynamically loaded Responses tools. Each retained image is preceded by text naming its complete attachment id and actual request dimensions. When the current execution filesystem maps the attachment provider's host object, the text also carries a read-only normalized-object path and warns that normalization or request projection may have resized or re-encoded the upload. Each occurrence selected by a logged image-offload decision keeps its own identity and currently resolved access in replacement text, and its normalized attachment is not read or transformed. When the retained occurrences' exact base64 payload still exceeds the route's `maxRequestImageBytes`, the call fails with `IMAGE_OFFLOAD_REQUIRED` so `dsh-compaction-image-offload` records the selected occurrences in an `image/offload` event and retries the step. Provider-native replay metadata is restored only when the adapter validates it for the historical content. `imageRequestTarget(provider, model, image)` exposes the same request-image dimensions and byte target to screenshot consumers; adapters without image resizing preserve the normalized source.

#### Token effect

Provider tokenization governs exact input. Retained images add the stable attachment and coordinate descriptor; the offload placeholder replaces an omitted image's visual tokens. Replay metadata may let a native API reuse provider-side state.

#### KV Cache effect

Later system messages supplied to the adapter stay out of the initial prompt, preserving the preceding request prefix. This does not change the agent loop’s prompt admission, which consolidates updates on routes without native system-update support. Conversion preserves logical request order, while image handles and offload placeholders add model-visible text. A changed execution-world path rewrites a historical handle and can prevent reuse from that image even when attachment identity and request bytes stay stable. Changing adapter instance, provider, model, or another upstream token has the same suffix effect, and a peak window's alternate provider is a provider change for that purpose: the first request of each window starts a new prefix. An offload decision turns an earlier image into placeholder text, so reuse ends at that message; the omission never reverts, so the prefix stays stable afterwards.

### Provider response

#### What the model sees

pi-ai events become harness reasoning, text, tool-call, usage, and finish chunks. The adapter passes parsed tool arguments to the harness as raw JSON strings. If pi-ai reports invalid completed arguments, the attempt fails with `MALFORMED_RESPONSE` before tool dispatch and publishes no successful replay state. The default normal retry policy excludes this code; an explicit retry policy still controls recovery.

#### Token effect

Generated content affects later inputs only after the loop records it. pi-ai folds reasoning tokens into output usage when the provider does not report them separately, and preserves its exact `totalTokens` value unchanged.

#### KV Cache effect

Recorded response content appends to the next request and does not invalidate its earlier reusable prefix. Unrecorded transport metadata and usage accounting do not affect cache identity.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define where the adapter stops and future work begins. They are current package constraints, not a general pi-ai comparison or a task backlog.

- **A bundled route's facts are a snapshot of the service** — Ollama Cloud's models can change without this build; a model the bundle does not name resolves from the route's capacities and offers no reasoning levels until it is added here, and a model the service retires stays listed until then.
- **A bundled entry's output cap is only as good as its source** — a vendor-documented maximum is used where one exists (GLM 5.3 and GLM 5.3 Flash state 131,072), and otherwise the entry carries the largest `max_tokens` Ollama's endpoint accepts, which is an upper bound rather than the model's own limit. Every value here is accepted by the endpoint, so an unsourced entry overstates a capability instead of failing a request.
- **`maxRequestImageBytes` counts base64 image payload only** — text, tools, descriptors, and JSON structure ride outside the bound, so it must sit below the gateway's request-body cap with headroom.
- **A sign-in lives only in the process that started it** — an authorization attempt is not durable, so reloading the page mid-login abandons it and the human starts over. Signing out is `deleteRecord` on the stored record, which forgets it locally without telling the issuer.
- **OpenAI offers no ChatGPT sign-in** — pi-ai's Sign in with ChatGPT identifies the installation to OpenAI with a stable UUID the app supplies, and the harness keeps no installation ID meant for a third-party account sign-in; the `openai` route signs in with an API key.
- **Provider-native discovery answers through this plugin's ambient context** — a route naming no credential defers to the catalog provider's own resolution, which asks for environment values (`AZURE_OPENAI_API_KEY`, `AWS_PROFILE`, and each provider's own set) and for local credential files. Both questions are answered here: the credential seam is consulted before the process environment, and file existence is checked against the host process's filesystem with `~` expanded. What it cannot do is *read* a credential file's contents — a provider that parses `~/.aws/credentials` itself does so directly, outside the seam.
- **Reset restores inherited configuration** — resetting a route supplied by a lower profile layer restores that route.
- **Complete Config replacement can remove inherited dictionary entries** — a field reset instead restores its inherited value.
- **`headers` can carry a credential the redactor never sees** — profile resolution rejects names and values Fetch cannot represent, but the dict remains plain strings; store credentials as `apiKeyEnv` references.
- **Discovery does not change configured models** — adopt discovery results explicitly into the route configuration.
- **Anthropic discovery reads at most 1,000 models** — the request uses the API's maximum page size but does not traverse `has_more`; entries beyond the first page must be added by hand.
- **Uncataloged models need an unambiguous protocol** — catalog routes preserve each model's protocol, including both Azure APIs under `azure`. A model absent from a mixed-protocol catalog needs an explicit route-level `api`, which overrides every model on the route and must be one of the supported custom protocols. For Azure deployment names, keep the catalog model ID and set `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`.
- **A bundled route carries no sign-in** — `ollama-cloud` authenticates through `apiKeyEnv` or the process environment like a hand-declared route, because nothing here ships an authorization flow for it.
- **A modality declaration is not verified** — a model declaring `image` its gateway does not serve is refused by the provider after prompt admission. The durable image remains in history and the same misdeclared model can fail again; switching to a text-only model remains possible because the shared LLM runtime projects image references into stable text for that request.
- **An unauthenticated route depends on its protocol** — a route naming no credential resolves as configured-but-keyless, but pi-ai's OpenAI-compatible implementation still requires an API key or an `Authorization` header, so a keyless local server needs a placeholder credential referenced by `apiKeyEnv` or an `Authorization` entry in `headers`.
- **Peak routing does not record the backend it used** — a request served inside a window still logs the configured route, so the concrete provider is visible only in that provider's own usage records.
- **The peak period is catalog data** — a deployment cannot set the hours or weekdays of a peak window, because they are the provider's published price policy; a model whose policy this build does not ship cannot be routed.
- **`GenerateOptions.stop` is unsupported** — pi-ai's common stream options cannot guarantee stop-sequence behavior across providers.
- **Conversation update support comes only from the installed pi-ai catalog** — native system and tool updates require the catalog model’s mid-conversation compat flags, which profiles cannot set. Hand-declared routes and unflagged models receive later system text as user-role reminders and the complete current tool list at the start of each request.
- **Images are accepted only in user and tool-result messages** — images in system, developer, or assistant history fail with `UNSUPPORTED_CONTENT` on both conversion paths.
- **Provider HTTP status is unavailable** — pi-ai error events do not expose a stable HTTP status across providers.
- **Retry policy is provider-owned, not an SDK retry** — pi-ai SDK retries stay disabled so durable agent steps and `llm/retry` events own every visible attempt, and direct `ctx.llm.stream()` calls remain single-attempt.
- **Streamed JSON tool-call arguments avoid per-delta reparsing** — the installed pi-ai carries [`patches/@earendil-works__pi-ai@1.3.0.patch`](../../../patches/@earendil-works__pi-ai@1.3.0.patch), which removes the per-delta re-parse of the whole accumulated argument JSON in every stream adapter (upstream [earendil-works/pi#9265](https://github.com/earendil-works/pi/issues/9265)); unpatched, a multi-megabyte argument stream costs O(n²) CPU on the event loop and stalls every session in the process. Completion events supply parsed arguments; Responses may parse at both argument completion and output-item completion. This adapter reads only delta strings and finalized arguments. Re-apply or retire the patch on every pi-ai upgrade.
- **Gemini tool-call thought signatures are patched into Chat Completions** — the same patch reads `tool_calls[].extra_content.google.thought_signature` from a streamed OpenAI-compatible response into the tool call's replay signature and sends it back as `extra_content` when the same model resumes (upstream [earendil-works/pi#10157](https://github.com/earendil-works/pi/issues/10157)); unpatched, Gemini rejects the next step of a tool-calling turn with HTTP 400. Encrypted OpenRouter reasoning details keep their `reasoning_details` replay.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is non-authoritative working context: undecided directions and notes for maintainers. Shipped behavior and accepted rationale live in the sections above, the package code, and the linked Agent Notes.

- The offered protocol set is deliberately narrower than pi-ai's full API set: Bedrock, Vertex, Azure, and Codex authenticate through flows a profile cannot completely describe with a key, an endpoint, and headers; catalog routes still reach them through their own provider, and only an explicit override is refused. Codex is sign-in-able through the authorization flow's OAuth grant.
- The `compat` switch set is pinned to pi-ai's compat types by drift gates; an upstream upgrade that adds a field, gives a further protocol a compat type, or widens a value union fails the build until someone classifies it.

</details>
