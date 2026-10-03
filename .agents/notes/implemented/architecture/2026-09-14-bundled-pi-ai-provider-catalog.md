# Agent Note: Bundle provider routes pi-ai does not ship

Status: implemented

English | [中文](2026-09-14-bundled-pi-ai-provider-catalog.zh.md)

## Problem

`dsh-llm-pi-ai` treats pi-ai's installed catalog as the only source of provider defaults. A route pi-ai does not ship therefore has to be declared in full, and two facts a listing endpoint never reports stay unavailable to it:

- **Context and output capacity.** A model resolves to the route's `defaultContextWindow` (262,144) and `defaultMaxTokens` (32,768). A deployment serving Ollama Cloud's `deepseek-v4.1-flash` gets a 262,144-token window for a model served at 1,048,576, so compaction and the context meter plan against a quarter of what the endpoint accepts. The output cap is worse than conservative: the endpoint rejects a `max_tokens` above its own ceiling outright, so a guess that is too high fails the request instead of clamping it.
- **Reasoning levels.** A model absent from the catalog has no `thinkingLevelMap`, so `resolveModelReasoning` reports `reasoning: false` and the model picker offers no effort at all — even though the endpoint accepts a reasoning parameter on every model it serves.

Naming the provider as a hand-declared route is not a fix: it moves the same facts into every deployment's `cordis.patch.yml`, where each one has to be copied by hand and re-copied when the service changes a model.

## Decision

`dsh-llm-pi-ai` ships a second, bundled source of catalog data beside pi-ai's, in `src/bundled-catalog.ts`. It carries **Ollama Cloud** (`ollama-cloud`): the endpoint, the wire protocol, and one entry per model with its context window, output cap, input modalities, and reasoning capability. The key names the cloud service, so a local Ollama server stays an ordinary hand-declared route under whatever id a deployment gives it.

The bundle is catalog *data*, not a pi-ai `Provider`. `catalogModels()` answers from it exactly as it answers from `getBuiltinModels()` for an installed route, and `catalogProvider()` keeps returning `undefined` for a bundled key — the function returns a provider that can serve requests, and a bundle carries no protocol implementation. `resolveProfiles()` defaults a bundled route's `api` and `baseURL` from the bundle before resolution, so a profile naming only a credential is serviceable, and a profile naming either field keeps winning: repointing a bundled route at a proxy is what those fields are for.

`catalogProviderIds()` is what configuration surfaces read, and it now returns the installed catalog followed by the bundled routes. A bundled route is therefore offered in the Models page's provider select and reported as `declared: false`, because this adapter does describe it — the question `declared` answers is whether the route's defaults come from anything, not whether pi-ai is that thing. `discoverModels()` answers a bundled route from the bundle with no network call, for the same reason it answers an installed one from pi-ai's registry.

### Reasoning levels are part of the catalog, not configuration

A bundled model's entries carry explicit reasoning levels. Every level maps to its own wire spelling, and every level the model cannot be asked for is pinned to `null`, because pi-ai's defaulting is asymmetric — an absent key means "supported" for the five base levels but "unsupported" for `xhigh`/`max`.

`off` is the one level with a model-dependent answer, and it is why the bundle stores `supportsOff` per model rather than assuming one behavior. Ollama's reasoning parameter is a value (`none`), not an omitted field, and omitting it selects the model's own default — which thinks for every model here. A model whose endpoint keeps producing reasoning output whatever it is asked declares `off: null`; that both withholds the level from selectors and makes pi-ai render the request without the parameter, so the control never claims something the model does not do. This is measured, not inferred from documentation: `/api/show` reports a per-model `thinking.values` list, but those are the levels the model prefers, and the endpoint accepts and acts on the wider set.

### Values are read from the service

Capacities, modalities, and reasoning behavior in the bundle were each read from Ollama Cloud's API rather than transcribed from a README: `contextWindow` from `/api/show`'s `<architecture>.context_length`, the output cap from the largest `max_tokens` the Responses endpoint accepts, `input` from `capabilities`, and the reasoning fields from whether a request that asks for each level actually returns a reasoning item.

`deepseek-v4.1-flash` carries its 393,216-token output maximum, the largest `max_tokens` its endpoint accepts.

## Alternatives considered

- **Require deployments to declare the facts.** Rejected because it is the status quo, and it puts a per-model snapshot of one service into every deployment's configuration file. A provider whose capacities are wrong by 4x produces compaction and context-pressure decisions that are wrong by the same factor, and each deployment pays that cost separately and silently.
- **A plugin a deployment mounts to contribute routes.** Rejected because the harness is pre-stable and a route this common belongs with the adapter that serves it. A third party that needs a different set of facts can declare the route as a hand-declared one, which nothing here changes.
- **Interrogate Ollama's `/api/show` at configuration time.** Rejected as the source of these facts: the endpoint requires a model id, so it cannot answer "which models exist" for the add-provider select, and it reports neither the accepted `max_tokens` ceiling nor whether asking for `off` changes behavior. It is a useful maintenance aid for refresh, not a runtime dependency.
- **Model the route as a real pi-ai `Provider` in the registry.** Rejected because `catalogProvider()`'s result is reused and streamed from. A bundled provider would have to carry an API implementation, which is exactly the coupling the bundled data avoids, and `buildProvider()` would silently reuse a provider whose stream member throws.
- **Declare `off` supported on every reasoning model.** Rejected because two served models (`gpt-oss:20b`, `gpt-oss:120b`) keep returning reasoning output when asked for `none`. Offering an off switch there would present a setting the provider ignores, which is the failure the seam's reasoning metadata exists to prevent.

## Consequences

A deployment that wants Ollama Cloud names it and its credential and gets a working route; the provider appears in the Models page's provider select like an installed one. A route the bundle does not name, or one whose profile names its own `api`, `baseURL`, or `models`, behaves exactly as before — nothing about hand-declared routes changed.

The bundle is a snapshot of a service that changes. A model added to Ollama Cloud after this build resolves from the route's `defaultContextWindow` and `defaultMaxTokens` and offers no reasoning levels until the entry is added; a model the service retires stays listed until then. `Known Limitations` in the package README states both.

Adding a bundled route means adding both its facts and the tests that pin them. The reasoning-level map is the part that needs care on a refresh: a model's `supportsOff` is a wire observation, not a field the service publishes, so it has to be re-measured rather than copied.
