# Agent Note: Peak provider alternates for one model entry

Status: implemented

English | [中文](2026-10-03-peak-provider-alternates.zh.md)

## Problem

A deployment that reaches the same model through two providers wants one provider during its normal hours and another peak — Ollama Cloud by day and OpenCode Go overnight, for example — with the same model id and reasoning effort. Neither existing owner expresses that.

- **Provider selection is per request, but configuration is static.** `dsh-llm` chooses the adapter by `LlmCallConfig.provider`, and `dsh-llm-pi-ai` materializes each route's `baseURL` and `api` when it resolves a model; only `apiKeyEnv` resolves per request. A model entry therefore cannot name two endpoints.
- **Routing at the agent loop changes the route identity.** An `agent/request` listener can rewrite `provider`, but the Session log, the model picker, and the model-selection switch notice all follow the rewritten provider: the picker flips to the alternate's group, and `installModelSelection` appends its "model changed" notice on every step of the peak window, because the assembled selection never matches the logged header.

## Decision

`dsh-llm-pi-ai` model entries take an optional `peak` list of destinations resolved from pi-ai's **installed catalog**, in priority order, with an optional `model` and `apiKeyEnv`. The period those destinations apply to is catalog data rather than configuration: a bundled model carries the peak window its provider publishes (`BundledModel.peakWindow`), and resolution composes that window with the configured destinations.

A price policy is not a deployment preference. A window authored in configuration can disagree with what the provider actually bills — a stored `21:00`-`03:00` JST window that omits weekdays routes away from the weekend Ollama charges its off-peak rate for, and nothing in the configuration says which reading is right. Keeping the period in one place removes that disagreement: configuration names where requests go, and the catalog states when.

The adapter resolves the effective route once per request, in `prepareCall()` and `stream()`, before the credential await. Inside a matching window it dispatches the candidate's catalog descriptor — for the model the candidate names, or for the routed model's own id when it names none; otherwise the route's own. The reported provider, model id, and Session log stay the configured route's, so the switch is invisible above the adapter: the picker keeps one provider group, no model-selection notice appears, and replay state survives because both routes are served by the same adapter instance.

A composed window is an inclusive `from` and an exclusive `to` `HH:mm`, read in its own IANA `timeZone`; a `to` earlier than `from` crosses midnight. The catalog states each window in the provider's own terms — Ollama Cloud's as `12:00`-`18:00` UTC on `mon`-`fri` — so no converted value is maintained by hand. Destinations resolve in configuration order, so a later candidate is used only when an earlier one cannot serve the model.

### Candidates are catalog data, not other routes

A destination must be an installed pi-ai provider that the catalog says serves the model the window sends it — the destination's own `model` when it names one, otherwise the routed model's id; configuration refuses a bundled route, a hand-declared route, and a model the destination does not describe. A window may therefore move the request to another model, including one of the same provider, rather than only to another endpoint of the same id. The adapter registers a catalog provider for each referenced candidate into its snapshot and builds a default execution profile for it, so a deployment does not also have to declare the alternate as a selectable route. The credential comes from the destination's `apiKeyEnv`, resolved per request as a route's own is.

A model whose window this build does not ship refuses destinations at load, because a period configuration cannot answer is a routing rule that would never fire. An entry that still stores a period from an earlier shape keeps validating — schemastery passes unknown keys — and resolution overrides it with the shipped window, so a stale period cannot reintroduce the disagreement this record removes.

The catalog carries each window's serving provider and model through `LlmModelInfo.routing`, so the Web model selector names that provider and marks it automatic while the window is active.

## Alternatives considered

- **An `agent/request` listener** — rejected because it changes the route identity in the Session log, triggers the model-selection switch notice on every step, and shows the alternate's provider group in the picker.
- **A new logical route with its own adapter** — rejected because it duplicates protocol handling the catalog provider already owns.
- **A local forwarding proxy** — rejected because Ollama Cloud speaks `openai-responses` while OpenCode Go speaks `openai-completions`, so the proxy would translate protocols and add a process to supervise.
- **Naming another configured route as the alternate** — workable, but a candidate resolved from the catalog keeps the picker from gaining a second group for the same model.

## Consequences

- The Session log records the configured route, not the backend that physically served the request; that detail lives in the provider's own usage records.
- Capacities and reasoning levels follow the candidate's catalog descriptor, so a window whose candidate differs in capacity changes `request/context` at each switch.
- Cross-provider fallback on failure is deliberately absent: a failed request does not retry on another destination.
- A provider whose peak policy this build does not bundle cannot be scheduled; adding one means adding its published window to the catalog.
- The retry policy captured at registration belongs to the configured route, not to the candidate.
