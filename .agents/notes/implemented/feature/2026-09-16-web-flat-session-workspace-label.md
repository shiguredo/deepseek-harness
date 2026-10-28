# Agent Note: Web flat session row workspace label

Status: implemented

English | [中文](2026-09-16-web-flat-session-workspace-label.zh.md)

## Problem

The Workspace browser offers two browsing modes. Grouped mode names each Workspace in its own header. The flat **In one list** mode drew every Session as one hierarchy-free row carrying only its status, title, and update time, so Sessions from different Workspaces became indistinguishable: a row no longer said which checkout, project, or working directory it belonged to, and search results — the one surface that did name the Workspace — are not browsing.

## Decision

`deriveFlat` projects the owning Workspace title onto every flat `SessionNode`, falling back to the Session's directory basename, so the flat projection answers the same label the search projection already answers. A flat row renders that label as an 11px tertiary line above the session title inside a two-line cell; an empty label renders the localized **Ungrouped** instead. Grouped rows keep their single-line cell because their group header already names the Workspace, and the flat row grows from the 32px grouped cell to a 45px minimum so the second line has room. The label is display data only: it moves no Session, changes no order, and carries no Workspace mutation.

## Testing

The tree spec proves the ownership projection (Workspace title, directory fallback, empty label, and first-title-wins for a Session several Workspaces account for); the row spec proves the label sits above the title, the Ungrouped fallback renders, and the flat status slot stays omitted; the browser spec proves the flat flip keeps names, order, and drag behavior while every row shows its Workspace; the style spec pins the flat row's minimum height. The change is model- and wire-invisible, so no snapshot or session-log fixture changes.

## Alternatives considered

- **A trailing Workspace reading beside the time.** Rejected: the 14px title and the trailing time already compete for one line, and truncating the title to fit a label hides the text the row exists for.
- **Workspace separator rows in the flat list.** Rejected: recency interleaves Workspaces, so separators would repeat unpredictably, and the manual drag order would acquire synthetic rows the drag model does not address.
- **Only the hover card.** Rejected: hover is not at-a-glance, while the Workspace has to read during scanning.
- **A per-row slot for a plugin.** Rejected: the label is data this package already derives, a per-row session-scope slot would need a scope binding per row, and the occupant would still need the label projected into the row.
- **Naming the Workspace only when it differs from the previous row.** Rejected: a row would sometimes omit the fact, making the reading depend on scroll position.

## Consequences

- Flat rows are taller (45px minimum against 32px), so the sidebar fits fewer of them.
- A consecutive run of Sessions in one Workspace repeats its label; the repetition is deliberate, because hiding it would make the reading depend on scroll position.
- Grouped browsing, counts, ordering, and drag behavior are unchanged; the label is presentation only, and no prompt, event, schema, or KV cache changes.
