---
kind: upgrade-guide
description: "The Ollama Cloud web search provider registers as ollama-cloud-search, and its endpoints and key are no longer configuration."
---

# Ollama Cloud web provider id and configuration

English | [中文](guide.zh.md)

## Change

`@deepseek-ai/dsh-web-ollama-api` registers its search provider as `ollama-cloud-search` instead of `ollama-cloud`, so the two ids it registers name their capability the way `ollama-cloud-fetch` does. The fetch id is unchanged. `ollama-cloud` also names the `llm-pi-ai` chat route, so the web seam no longer reuses it.

The two endpoints and the API key are no longer configuration. Both operations reach `https://ollama.com/api/web_search` and `https://ollama.com/api/web_fetch`, and both authenticate with `OLLAMA_CLOUD_API_KEY`, the reference the Ollama Cloud model route already stores; the plugin registers its providers while that key resolves. The `apiKey`, `apiKeyEnv`, `searchBaseURL`, and `fetchBaseURL` fields are gone, and `maxResults` is the only remaining field. The Ollama Cloud search settings page now shows the switch and the result count, and reports whether the shared key resolves.

A deployment that lets the provider be selected automatically needs no change. A profile patch, `cordis.yml`, or overlay that sets `web.searchProvider: ollama-cloud` breaks: the Web search and fetch page shows `ollama-cloud (not loaded)`, and `web_search` fails with `WEB_PROVIDER_CONFIGURED_MISSING` until the selection names the new id. Fields the plugin no longer declares are ignored rather than rejected, so a leftover `apiKeyEnv` changes nothing and may hide that the key now resolves only under `OLLAMA_CLOUD_API_KEY`.

## Migration

1. In every profile patch, `cordis.yml`, or overlay that sets `web.searchProvider`, replace `ollama-cloud` with `ollama-cloud-search`.
2. Delete `apiKey`, `apiKeyEnv`, `searchBaseURL`, and `fetchBaseURL` from the `web-ollama-api` row. Keep `maxResults` if the deployment set it.
3. Confirm `OLLAMA_CLOUD_API_KEY` resolves in the credential store or the launching environment; the web providers do not register without it.
4. On the Web search and fetch page, select the Ollama Cloud entry again wherever a stored selection still names the old id, then run one `web_search` and check that it succeeds.
