---
description: "The Ollama Cloud-backed search and fetch providers for ctx.web: how deployments mount POST /api/web_search and POST /api/web_fetch behind one key and one pair of live endpoints."
kind: "package-reference"
---

# @deepseek-ai/dsh-web-ollama-api

English | [中文](README.zh.md)

## Summary

With `dsh-web-ollama-api`, the harness searches the web through Ollama Cloud's `POST /api/web_search` and retrieves single pages through `POST /api/web_fetch`, using an `OLLAMA_CLOUD_API_KEY`. Choose it when a deployment holds an Ollama Cloud API key and wants both retrieval directions without a full model turn. Ollama Cloud returns no generated answer, so search results carry no `content` — only citeable sources. An entry without a URL is dropped, so a call can return fewer sources than requested. Both endpoints and the search result count are live settings the Ollama Cloud search page edits. The model-facing `web_search` and `web_fetch` tools live in `dsh-tool-web`.

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

Mount the plugin in a composition that already loads the web service; it registers as the `ollama-cloud` search provider and the `ollama-cloud-fetch` fetch provider, so `ctx.web` resolves either automatically when it is the only usable backend of that kind — or pin them with `searchProvider: ollama-cloud` and `fetchProvider: ollama-cloud-fetch`. The two share one API base and one key because Ollama serves and authenticates both operations that way.

### When to choose it

Choose this backend when a deployment holds an Ollama API key and wants dedicated retrieval endpoints rather than a model-mediated search or an anonymous local fetch. Each provider is unavailable when its endpoint does not parse; the search provider is also unavailable when the result count is not a positive integer. A missing key fails the first operation with a structured `WEB_PROVIDER_CREDENTIAL_MISSING` error.

### Minimal configuration

Load the web service and the plugin; the key resolves from `ctx.credentials` when that service is mounted, otherwise from `$OLLAMA_CLOUD_API_KEY` in the launching environment. Each operation reads its own endpoint override — `$OLLAMA_SEARCH_BASE_URL` and `$OLLAMA_FETCH_BASE_URL` — over the default `https://ollama.com`, appending `/api/web_search` or `/api/web_fetch` unless the value already names that full endpoint.

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-ollama-api'
  config:
    apiKeyEnv: OLLAMA_CLOUD_API_KEY
```

| Field | Default | Meaning |
|---|---|---|
| `apiKey` | omitted | Literal Ollama API key; prefer `apiKeyEnv` so no secret enters configuration. A non-empty literal wins over `apiKeyEnv` |
| `apiKeyEnv` | `OLLAMA_CLOUD_API_KEY` | Credential reference resolved for each operation through `ctx.credentials`, or from the process environment when that service is absent. An operation that needs a key and finds none fails as `WEB_PROVIDER_CREDENTIAL_MISSING` |
| `searchBaseURL` | `https://ollama.com` | Search endpoint base, or the full `/api/web_search` endpoint; the path is appended when absent. Falls back to `$OLLAMA_SEARCH_BASE_URL`; an unparseable value makes the search provider unavailable |
| `fetchBaseURL` | `https://ollama.com` | Fetch endpoint base, or the full `/api/web_fetch` endpoint; the path is appended when absent. Falls back to `$OLLAMA_FETCH_BASE_URL`; an unparseable value makes the fetch provider unavailable |
| `maxResults` | `5` | Positive-integer default result count when a search request carries no `maxResults` |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-ollama-api) is the exhaustive source for every accepted field and its JSDoc. Every field is live: the Ollama Cloud search page writes them through the plugin entry, and each operation captures the current values.

### What a search returns

Each Ollama result maps to a `WebSearchSource`: `url`, an optional `title`, and the entry's trimmed `content` as `snippet`; an entry with no URL has nothing to cite and is dropped. A request's `maxResults` wins over the configured default and is sent to Ollama as `max_results` as a cost and latency optimization — the final bound is enforced by the service, which truncates and flags. Ollama returns no generated answer, so the result carries no `content`.

### What a fetch returns

The API answers with the page's Markdown in `content`, and fails when the page yields none. It reports neither the target's HTTP status nor a final redirect URL, so a successful fetch reports the requested URL with status 200 and an empty `truncated`; the page title and the `links[]` list are not part of the shared fetch result and are discarded.

### Failures and recovery

Provider failures — HTTP errors, network failures, unparseable bodies — surface as `WebError` `WEB_PROVIDER_ERROR`; a missing credential is `WEB_PROVIDER_CREDENTIAL_MISSING`; an aborted operation surfaces as `WEB_ABORTED`. HTTP redirects are rejected before the `Location` target is contacted and surface as `WEB_PROVIDER_ERROR`. Every failure after dispatch names the resolved endpoint and explains that endpoint configuration is separate from chat; the message points at the two URL fields on the Ollama Cloud search page under Settings > Plugins and, when that page is unavailable, at `OLLAMA_SEARCH_BASE_URL`/`OLLAMA_FETCH_BASE_URL` and `web-ollama-api.searchBaseURL`/`fetchBaseURL`. Callers route on the code; the model-facing tools surface failures to the model under their own error wrapper.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the providers; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The two providers are thin adapters over Ollama's web endpoints, with three deliberate rules:

- **Citeable sources only.** A result without a URL is dropped rather than cited by an invented one, and a `snippet` comes only from the entry's own `content`.
- **No invented answers.** Ollama returns no generated answer, so `content` is omitted rather than fabricating provider prose the model might trust.
- **One key, one base.** Both operations resolve credentials and dispatch through the shared transport, because Ollama serves and authenticates them from one host.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: live config schema, environment fallback, both provider registrations |
| [`src/transport.ts`](src/transport.ts) | Endpoint resolution, credential resolution, redirect-rejecting dispatch, abort classification, failure guidance |
| [`src/search.ts`](src/search.ts) | The `OllamaSearchProvider` and its result mapping |
| [`src/fetch.ts`](src/fetch.ts) | The `OllamaFetchProvider` |
| [`src/types.ts`](src/types.ts) | Ollama wire types: the search and fetch envelopes and `OllamaError` |

### Request flow

`search()` posts the query and result count to the resolved search endpoint with a bearer key and `redirect: 'error'`, so a redirect fails the request without contacting the target; the parsed `results[]` are mapped one by one, URL-less entries dropped, and the service applies the final `maxResults` bound on the way back. `fetch()` posts the URL to the resolved fetch endpoint the same way and returns the page's Markdown. An abort — a `DOMException` named `AbortError` — becomes `WEB_ABORTED`; anything else becomes `WEB_PROVIDER_ERROR`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search and fetch request/result vocabulary and error codes.
- [Web package map](../README.md) — the web package family and each role.
- [dsh-web](../web/README.md) — the web service these providers register into.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` and `web_fetch` tools that render these providers' results.
- [dsh-client-ui-settings-web-search-ollama](../../client/ui-settings-web-search-ollama/README.md) — the settings page that selects both providers and edits the endpoints.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-ollama-api) — every accepted config field and its source declaration.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-web`, which retains this plugin's `maxResults`-bounded URLs, titles, and page excerpts or the fetched page Markdown, together with its exact `Ollama Cloud web request aborted`, `Ollama Cloud search request failed: <error>`, and `Ollama Cloud returned an unprocessable response body: <error>` failures, under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the providers are a poor fit. They are current package constraints.

- **A result with no URL is dropped entirely** — there is no citeable source to map, so fewer sources than requested can return.
- **The fetch result drops what the seam has no field for** — the page title and `links[]` are read past, and the reported status is always 200 because the API reports no target status.
- **Only the two endpoints and the result count are exposed** — Ollama Cloud's other request controls wait on provider-neutral service fields.
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError` maps to `WEB_ABORTED`; an abort carrying a custom reason surfaces as `WEB_PROVIDER_ERROR`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Future: wider Ollama control surface

Ollama Cloud's other request controls stay unexposed. Exposing them needs provider-neutral service fields first, so the family adds one coordinated control rather than a vendor-specific argument.

</details>
