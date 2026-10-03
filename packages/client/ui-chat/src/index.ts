/** Host registration for browser Chat preferences. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Volatile, Context } from '@deepseek-ai/cordis'
import type { ChatSettings, ClockTimeZone, LinkOpening, PerformanceUsageMode } from './chat-settings.ts'
import z from '@deepseek-ai/schemastery'
import { CLOCK_TIME_ZONE_FIELD, TRANSCRIPT_VIEW_FIELD } from './chat-settings.ts'

import { ChatSettingsFields } from './chat-settings.ts'

export {
  CHAT_SETTINGS_NAMESPACE, CLOCK_TIME_ZONE_FIELD, CLOCK_TIME_ZONES, DEFAULT_CLOCK_TIME_ZONE,
  DEFAULT_TRANSCRIPT_VIEW_MODE, LEGACY_TRANSCRIPT_VIEW_MODE, LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
  TRANSCRIPT_VIEW_FIELD, TRANSCRIPT_VIEW_MODES,
  type ChatSettings, type ClockTimeZone, type TranscriptViewMode,
} from './chat-settings.ts'

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Completed turn transcript presentation. */
  transcriptView: Volatile<ChatSettings['transcriptView']>
  /** Performance and usage detail level. */
  performanceUsage: Volatile<PerformanceUsageMode>
  /** Default destination for Chat HTTP(S) links. */
  linkOpening: Volatile<LinkOpening>
  /** Zone the message clocks read. */
  clockTimeZone: Volatile<ClockTimeZone>
}

/** Live preferences projected to the browser. */
export const Config = z.object({
  [TRANSCRIPT_VIEW_FIELD]: ChatSettingsFields[TRANSCRIPT_VIEW_FIELD].volatile(),
  performanceUsage: ChatSettingsFields['performanceUsage'].volatile(),
  linkOpening: ChatSettingsFields.linkOpening.volatile(),
  [CLOCK_TIME_ZONE_FIELD]: ChatSettingsFields[CLOCK_TIME_ZONE_FIELD].volatile(),
})

/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
