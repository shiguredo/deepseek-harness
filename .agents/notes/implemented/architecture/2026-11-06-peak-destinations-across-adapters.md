# Agent Note: Peak destinations may run on another adapter's route

Status: implemented

English | [中文](2026-11-06-peak-destinations-across-adapters.zh.md)

## Problem

A deployment avoids Ollama Cloud's peak price by routing those hours to another provider, and that provider is often already configured through its own adapter: `deepseek-official` carries the Messages protocol, the in-history system-prompt mode, the addition-only tool-update mode, and the credential reference that route already resolves. The [peak-provider alternates](2026-10-03-peak-provider-alternates.md) decision accepted only installed pi-ai providers, so that route was refused at load while the Models page offered it as a destination, and the only DeepSeek destination it allowed was pi-ai's own `deepseek` catalog route. That route speaks OpenAI Chat Completions and declares no mid-conversation system-message support for `deepseek-flash`, so the loop rewrites the leading system prompt every step and the prompt cache never reuses a prefix — the opposite of what a cost-motivated window wants.

## Decision

A `peak` destination is one of two things.

- A route the installed pi-ai catalog describes stays inside `dsh-llm-pi-ai`. The snapshot materializes it with the catalog's models and builds a default execution profile when no route declares it, and the model it must serve is still checked at load.
- Any other destination names a route the deployment registers. `PiAiAdapter.alternateRoute()` hands that route and the model it receives to `LlmRuntime`, which resolves the provider's registration and dispatches the call through the owning adapter. `dsh-llm`'s `LlmAdapter.alternateRoute()` is the seam: the executing route's adapter owns the endpoint, protocol, model, and credential, so configuration refuses a window `apiKeyEnv` on such a destination.

The requested provider and model stay the call's identity. `LlmRuntime.prepareCall()` and a direct `stream()` resolve the dispatch target once before adapter I/O, report the requested provider, model, and retry policy, and take context, modalities, and conversation-update modes from the metadata the executing route returns. The request passed to the executing adapter names that route's provider and model, because every adapter reads its route from the request, while the caller's config, the logged `request/header`, and the model picker keep the configured route.

Configuration accepts any non-empty destination. A settings write also checks that a destination the installed catalog does not describe is registered at that moment; a YAML load cannot make that check, so a missing route fails the first request with `NO_ADAPTER` naming both routes. The Models page offers only providers that are configured and registered, which is what lets it offer the native `deepseek-official` row.

## Alternatives considered

- **Point the window at pi-ai's `deepseek` catalog route** — the only DeepSeek destination the previous design allowed. It reaches the same API with the same key, but through OpenAI Chat Completions: the installed catalog marks `deepseek-flash` as not supporting mid-conversation system messages, so the leading system prompt is rewritten on every step and the prompt-cache prefix breaks.
- **Keep dispatch inside `dsh-llm-pi-ai` and let it call another adapter** — an adapter cannot reach the registry, and calling `ctx.llm.stream()` would run the `llm/stream` waterfall twice, repeating checkpoint and title listeners for one request.
- **Require every destination to be a registered route, including catalog ones** — uniform, but a catalog alternate (for example `opencode-go` with its ambient credential) would need a profile of its own and would gain a picker group. The split keeps the existing catalog behavior untouched.
- **Move all peak routing into `dsh-llm`** — the window data, the bundled price policies, and the destination validation live with the pi-ai adapter; the service would have had to learn one adapter family's vocabulary.

## Consequences

- A request executed on another adapter's route starts from provider-neutral history: replay state belongs to the adapter that produced it, and `LlmRuntime.forAdapter()` strips it when the executing adapter differs from the message's source provider. Each request in that window therefore starts a new prefix.
- The retry policy stays the requested route's. Recovery follows the route the operator selected, not the route that happens to execute during a window.
- A destination route that is disposed or never registered fails the call at the earliest resolvable point with `NO_ADAPTER`; a settings write refuses it before persistence.
- Peak routing still logs only the configured route, so the backend that served a request remains visible only in that provider's own records.
