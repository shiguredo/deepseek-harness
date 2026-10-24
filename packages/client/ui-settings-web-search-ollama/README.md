---
description: "The Ollama Cloud web provider's settings page on the dsh web client's Plugins page: whether this deployment uses it, its API key, the endpoint each operation reaches, and the default result count."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-web-search-ollama

English | [中文](README.zh.md)

## Summary

Open **Plugins** in the sidebar and select **Ollama Cloud search** in the Official group to decide whether this deployment searches and fetches through Ollama Cloud, and to set that provider's key, its two endpoints, and the result count search applies. The page stages what is typed and writes it only on save, marks the values the user overrode, and offers to reset each back to the deployment's default. The key is written through the credentials domain rather than the settings document, so its literal never rides a response. The page exists while the Host serves the `web-ollama-api` namespace.

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

The **Ollama Cloud search** card in the Official group opens the page, whose control is a switch plus three fields and a key.

**Use Ollama Cloud for web search and fetch** writes `web.searchProvider` and `web.fetchProvider` together. On selects `ollama-cloud` and `ollama-cloud-fetch`, clearing the override when the deployment already composes them. Off clears the override too, so the deployment's own selection applies again; a deployment that composes the Ollama Cloud pair itself instead gets the shipped DeepSeek and local-HTTP ids, the only other selection this page can name. The switch is drawn only while the Host serves both the `web` and `web-ollama-api` namespaces.

**API key** starts blank on every load and reports only whether a key is configured; a blank draft keeps the stored key, and the control is disabled when the credential cannot be written from here, such as a key the process environment supplies. It addresses `OLLAMA_CLOUD_API_KEY`, or the `apiKeyEnv` the section names.

**Search API URL** and **Fetch API URL** render the effective value, show the endpoint each operation falls back to while it is empty — `https://ollama.com/api/web_search` and `https://ollama.com/api/web_fetch`, in faint text — and save as a reset back to the composed default when emptied. The provider appends its operation path to a value that names the shared base, so both `https://ollama.com` and the full URL are accepted.

**Results per search** is the count the provider sends when a caller requests no bound of its own; a smaller caller bound still wins.

Nothing is written until **Save**; leaving the page drops the drafts, and text that is not a number blocks the save and says so under the field. The fields stay editable while the selection is not served, and the switch stays hidden then.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host half is an empty `apply`, present only so the package holds a Loader row the client module system serves the browser half for. The browser half binds the composed `web-ollama-api` entry and the `web` selection through `ctx.configForms.get`, keeps two staged forms in `OllamaSearchCardController` over the shared `SettingsFormModel` of `ui-primitives`, and registers `OllamaSearchCard` into the Plugins page's `plugins.shiguredo` slot (the group after Experimental) through `ctx.configForms.whileServed`, which registers while the Host serves the provider entry and withdraws when it stops. Selecting both providers stages the `web` section; the endpoints, the result count, and the key stage the provider section, and the save writes the provider section first so the switch never points at an endpoint that has not landed. The key is the forms' one secret control: its write goes to `remote.credentials.set` under the reference the section names, and the configured badge is read back from `remote.credentials.describe`, re-read when the Host reports `credentials/reference-updated` for that reference. The page's copy lives in this package's `settings.webSearchOllama` dictionary; the `SettingsForm` frame takes its copy as props.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-plugin-manager](../ui-plugin-manager/README.md) — the Plugins page and the `plugins.shiguredo` slot the page registers into.
- [ui-settings](../ui-settings/README.md) — the settings scopes and the served-namespace watch the page rides.
- [ui-primitives](../ui-primitives/README.md) — the settings form model and fields the page renders.
- [credentials](../../credentials/README.md) — the credential-reference seam the key writes through.
- [web-ollama-api](../../web/web-ollama-api/README.md) — the provider that registers the `web-ollama-api` namespace and both provider ids.
- [ui-settings-web-search](../ui-settings-web-search/README.md) — the DeepSeek search provider's own page, which stages its selection the same way.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side settings surface that registers no model surface.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **The page edits a subset of the served schema** — `apiKeyEnv` is a credential reference the deployment owns, so the page reads it to address the key and offers no control for it; `apiKey` is rendered only through the credentials domain.
- **The switch can only name two selections** — it writes the Ollama Cloud ids or clears the override, so a deployment whose composed selection is the Ollama Cloud pair itself cannot express any third state from this page.
- **Only this provider has a page** — Exa and Perplexity are configured through their composition entries alone, because a page per optional provider would repeat this package without a product that asks for one.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
