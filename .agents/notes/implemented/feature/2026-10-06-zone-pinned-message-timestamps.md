# Agent Note: message timestamps become a zone-pinned caption line

Status: implemented

English | [中文](2026-10-06-zone-pinned-message-timestamps.zh.md)

## Problem

Chat dated every message through the shared IconActions row: the user bubble and the completed-turn footer carried an `HH:mm` clock beside the copy and branch buttons, and that clock was hidden along with those buttons on every row but the latest. Three problems followed.

The clock shared a row with interactive controls, so a reader who only wanted the time had to hover to reveal it. The clock read the process zone, which a reader working across regions could not pin to the zone a Session actually ran in, and the row's layout tied the clock's size to the content font-size preference. A reader scanning a long transcript for when something happened had to hover each row and interpret an unlabeled clock in whatever zone their device happened to use.

## Decision

Every message timestamp is one caption line beneath the message it dates, rendered by `MessageClock` from `formatMessageClock`: the user and steering bubble, the completed-turn footer, and a Turn-trigger notice. The line always spells out the displayed zone's full `YYYY-MM-DDTHH:mm:ss`, and a pinned zone names itself in parentheses (`2026-01-01T10:10:10 (JST)`), so a device clock and a pinned clock are never confused. Its size is a fixed 11px caption with tertiary ink, so it stays a quiet second tier while the message text follows the Settings font-size preference; it carries no hover gate and is visible on every row.

Settings → General → Timestamp time zone stores `ui-chat.clockTimeZone` as `local` (default), `jst`, or `utc`, read through the `ClockTimeZonePolicy` config form the way `performance-usage.ts` reads its own field. `ChatView` binds the live zone and passes it down `ChatNodeOwnerProps.clockTimeZone`, so a Node that dates itself from the Session log renders that clock directly. The Turn-trigger notice keeps its header clock and reads the same zone.

`jst` and `utc` are fixed offsets, so their wall clock comes from the UTC getters of a shifted instant; `local` reads the runtime calendar because its offset moves with daylight saving. The text depends only on the recorded event time, so the clock subscribes to no timer and needs no re-render when a date boundary passes.

Copy, branch, and Turn-usage icons still reveal on hover or focus. The IconActions row keeps its space with opacity, so revealing the icons never moves the clock line beside it. `MessageIconActions` no longer takes a clock prop at all; its `variant` prop selects the assistant glyph size.

## Alternatives considered

**Keep the clock in the IconActions row and only add the zone setting.** This was the smaller diff, but it leaves the timestamp behind the hover gate and inside a row sized for its buttons — the two facts the change exists to fix.

**Read the zone as a free IANA zone like `ui-schedule`.** Schedule rules genuinely store a zone per rule; a message clock only needs to answer "which of these happened when", and a free picker would add a searchable list, a recent-zone memory, and a per-Session display zone to every message row for no additional answer. The two pinned zones cover the cross-region reading cases this feature was asked for.

**Format through `Intl.DateTimeFormat` with a `timeZone` option.** Correct for arbitrary zones, but it would make every message row construct or cache a formatter, and the two pinned zones are fixed offsets that plain arithmetic already names exactly.

**Keep `HH:mm` for the current day and add the date only across days, with a midnight timer to widen it.** The previous clock did this. Always naming the full date and clock removes the timer, the reference instant, and the whole class of boundary bugs, at the cost of a longer line — and the line was already reading as a caption, not as a clock beside the buttons.

**Keep the short `HH:mm` and label only the zone.** That reads well inside one sitting, but two messages from different days would then look adjacent; the full timestamp is the point of putting the clock on its own line.

**Store an instant-anchored local-day epoch, as the previous `startOfLocalDay` did.** No render reads a day epoch any more: every clock field derives from its own event time.

## Consequences

The clock leaves the icon row, so the assistant footer and the user bubble each render two stacked lines where they rendered one; a message whose clock sits above a short bubble reads with one extra line of chrome. A pinned zone labels itself, so a device clock and a pinned clock are never confused, at the cost of three extra characters on the line.

A conversation spanning a year boundary now names the year explicitly, which the previous year-less clock could not. The date is always present, so a row is one text run longer than a same-day `HH:mm` clock was; the line reads as a record rather than as a glanceable clock.

The zone preference is durable on loopback browsers and process-local elsewhere, exactly as the other Chat display preferences behave; it changes presentation only and never touches the Session log.

## Testing

`packages/client/ui-chat/tests/chat-branch-tails.client.spec.tsx` pins the full field order, the pinned-zone arithmetic behind the parenthesised name, and the rendering through a user bubble and a zone change; `clock-time-zone.client.spec.ts` and `clock-time-zone-row.client.spec.tsx` cover the policy and the Settings row; `config.host.spec.ts` validates the new field; `chat-apply.client.spec.tsx` pins the row order; `chat-font-axis-styles.client.spec.ts` pins the caption size and the assistant glyph size. The Web e2e goldens for the Settings dialog move, and every message-clock golden moves with the added date.
