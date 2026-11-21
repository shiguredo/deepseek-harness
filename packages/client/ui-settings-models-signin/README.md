---
description: "Models-page provider sign-in: the Host Remote over the authorization seam and the provider-card section that lists, starts, watches, answers, and cancels one sign-in, including the paste step a browser on another machine needs."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-models-signin

English | [中文](README.zh.md)

## Summary

This package puts a provider's account sign-in on its Models-page card. It contributes one section to the `llm-pi-ai` family's cards: the Host lists the authorization flows the composition registered, the section starts one, reports the browser step, and — when the browser runs on another machine — takes the redirect URL the human pastes back. The flow belongs to the authorization seam, the credential record belongs to the credential store, and neither surface writes a Session message.

## Table of Contents

- [Use this package](#use-this-package)
- [What to expect](#what-to-expect)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount it beside [`dsh-client-ui-settings-models`](../ui-settings-models/README.md), whose `settings.models.provider-card` seat it fills, and beside an adapter that registers authorization flows, such as [`dsh-llm-pi-ai`](../../llm/llm-pi-ai/README.md) with `chatGptSignIn: true`. The package takes no configuration.

The Host half registers the `modelSignIn` Remote, and the browser half registers the dictionary namespace and the card section. Both are effects of their plugin fibers, so unloading the package removes the section, the panel, and their copy.

<a id="what-to-expect"></a>
## What to expect

A card shows the account section only while that card is open for editing — the add-provider draft, a first-run setup card, or a saved row whose **Edit** was pressed — so a collapsed row summarizes the provider and cannot sign in or out, and a composition that never enabled a provider sign-in shows nothing extra. A collapsed row does carry one fact, through the page's row-mark seat rather than this card section: when an account sign-in supplies that route, the row shows a green **Signed in with ChatGPT** mark on its name line. The page's own credential dot speaks for an api-key reference, which a plan-paid route does not have, so without the mark a ready route would look unconfigured. When a flow exists, the section shows whether a credential is stored and the flow's own first-method label — "Continue with ChatGPT" for OpenAI's sign-in, which is the wording OpenAI publishes.

The section states what the browser step will ask for before it starts, and — when the card is a draft that is not saved yet — that saving is what makes the account usable. Choosing it starts one attempt and opens a panel: the browser step's page, the flow's notices, and a redirect-URL field that is visible from the start. The field is the remote path: a browser on another machine reaches its own `127.0.0.1`, so the human copies the callback URL from the address bar and pastes it here; the Host validates it with the same state it generated. A local browser completes through its loopback callback and the panel reports success on its own.

The first sign-in leaves a confirmation that eligible requests use the ChatGPT plan, with a **Manage usage** link to ChatGPT's usage settings; later sign-ins in the same browser skip it, as OpenAI's guidelines ask, because the confirmation is about the account being new rather than about every renewal. Signing out forgets the stored record.

The model menu carries the plan row: `Using ChatGPT plan` with **Manage usage** beneath it, shown while the selected model's route is paid for by a sign-in grant and omitted otherwise. It appears exactly where someone is already looking at what serves the Session — the placement OpenAI's guidelines illustrate — and costs nothing while the menu is closed.

The composer says nothing while the plan simply pays: a line repeating which plan funds the selected model is noise where a person writes. It speaks once the plan's own usage limit stops a request — what ran out, that the plan or this app's own limit may be the cap, and **Manage usage** as the action that resolves it — because that is the one moment the settings page behind it matters. A standing line under the actions states who the plan serves — OpenAI's help center names Go, Plus, Pro, and Business subscribers, with a Business workspace applying its own controls — and that the sign-in follows the [Sign in with ChatGPT Terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) and the plan's own limits, with a **View terms** link to the page in the interface's language, because the plan, its limits, and the consent the flow asks for belong to OpenAI rather than to this package.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

One attempt is one `ctx.authorization.begin` call held open by the Host. The Remote stores the attempt under a Host-generated id, hands the flow an interaction that appends notices to the view, and turns each flow prompt into a pending question with an attempt-local id. The browser polls the view; an answer names the question id, so a superseded question — the losing half of a paste-versus-callback race — cannot be answered late. Cancelling withdraws the seam's attempt for that key.

The view carries no credential: notices, the pending question, the phase, and a failure message only. `signOut` deletes the credential record, and it refuses while an attempt for the same key is running so a late commit cannot resurrect what was just removed.

The paste field always answers the flow's own `manual_code` prompt; the section never constructs the callback exchange itself.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [`dsh-llm-pi-ai`](../../llm/llm-pi-ai/README.md) — the adapter that registers the ChatGPT sign-in flow and the installation id it presents.
- [`dsh-authorization`](../../credentials/authorization/README.md) — the capability seam, its notices and prompts, and the attempt lifecycle.
- [`dsh-credentials-local`](../../credentials/credentials-local/README.md) — the record store the flow commits into.
- [`dsh-client-ui-settings-models`](../ui-settings-models/README.md) — declares `settings.models.provider-card`.
- [Sign in with ChatGPT terms](https://openai.com/policies/sign-in-with-chatgpt-terms/) — the terms this surface states it runs under.
- [Sign in with ChatGPT for open-source apps](https://developers.openai.com/siwc/token-sharing-open-source) — the developer guide for the flow the section drives.
- [Slots reference](../../../docs/subsystems/slots.md) — how a plugin registers into another plugin's declared slot.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package presents browser chrome over the authorization seam and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request. The provider's sign-in changes which credential later requests use, not their content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define the shipped surface and what it deliberately does not do.

- **The section needs both halves and an adapter flow** — the browser half renders only when the Host half's `modelSignIn` Remote is mounted and the adapter registered a flow; otherwise the card shows nothing rather than an empty account area.
- **A browser on another machine needs the paste step** — the callback is a `127.0.0.1` loopback on the Host, so a remote browser completes only by pasting the final redirect URL; the panel states this beside the field.
- **The plan line reads the failure text** — a Client receives failures as messages, not codes, so the limit state appears when the reported failure carries `subscription_sharing_usage_limit_exceeded`. The adapter's own error classifier reads provider text the same way, and the code is the stable part of that text; a failure that names the limit differently shows as an ordinary error.
- **One attempt per provider** — two tabs of the same client cannot run two attempts for one record, because the seam refuses the second; the losing tab sees that refusal.
- **Eligibility is OpenAI's answer, not this package's** — the help center names Go, Plus, Pro, and Business subscribers for plan usage; a Business workspace spends its included allowance on Standard and Premium seats under its own controls and workspace credits on usage-based seats, and the request path reports `subscription_sharing_user_not_eligible` when the selected user, workspace, or policy is refused. The section states the terms it runs under and links them instead of restating them, so a change on OpenAI's side reaches the user through OpenAI's own page.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The Host spec mounts the real authorization seam and a local credential store, registers a fake flow that asks one question, and drives the Remote through list, begin, poll, answer, cancel, and signOut. The browser side has no spec of its own yet; the Models-page web e2e lane covers the section's rendered copy and the flow it starts.

</details>
