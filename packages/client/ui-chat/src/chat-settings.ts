/** Chat display preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the Chat target. */
export const CHAT_SETTINGS_NAMESPACE = 'ui-chat'

/** Field carrying the work-details presentation mode. */
export const TRANSCRIPT_VIEW_FIELD = 'transcriptView'

/** Field carrying the zone message clocks read. */
export const CLOCK_TIME_ZONE_FIELD = 'clockTimeZone'

/** Work-details presentation modes a user can choose. */
export const TRANSCRIPT_VIEW_MODES = ['compact', 'standard', 'detailed', 'verbose'] as const

/** Work-details presentation mode. */
export type TranscriptViewMode = typeof TRANSCRIPT_VIEW_MODES[number]

/**
 * Saved value from the two-mode generation of this setting. Read as `detailed`;
 * never offered as a choice and never written back.
 */
export const LEGACY_TRANSCRIPT_VIEW_MODE = 'normal'

/** Saved `expanded` values read as `detailed`, without being offered or written back. */
export const LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE = 'expanded'

/** Every value the durable field accepts: current modes plus legacy saved values. */
const TRANSCRIPT_VIEW_SETTING_VALUES = [
  ...TRANSCRIPT_VIEW_MODES, LEGACY_TRANSCRIPT_VIEW_MODE, LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
] as const

/** Default work details for non-Desktop Web clients. */
export const DEFAULT_TRANSCRIPT_VIEW_MODE: TranscriptViewMode = 'detailed'

/** Performance and usage detail levels accepted by user settings. */
export const PERFORMANCE_USAGE_MODES = ['compact', 'detailed'] as const

/** Performance and usage presentation. */
export type PerformanceUsageMode = typeof PERFORMANCE_USAGE_MODES[number]

/** Preserve detailed accounting for users without an explicit preference. */
export const DEFAULT_PERFORMANCE_USAGE: PerformanceUsageMode = 'detailed'

/** Destinations for ordinary clicks on Chat HTTP(S) links. */
export type LinkOpening = 'sidebar' | 'new-tab'

/** Preserve the built-in browser for users without an explicit preference. */
export const DEFAULT_LINK_OPENING: LinkOpening = 'sidebar'

/** Zones a message clock can be pinned to; `local` follows the device. */
export const CLOCK_TIME_ZONES = ['local', 'jst', 'utc'] as const

/** Zone message clocks read. */
export type ClockTimeZone = typeof CLOCK_TIME_ZONES[number]

/** Follow the device zone for users without an explicit preference. */
export const DEFAULT_CLOCK_TIME_ZONE: ClockTimeZone = 'local'

/** Durable Chat section shared by the Host schema and browser scope. */
export interface ChatSettings {
  /** Work-details preference; absence uses the client default, and legacy saved values remain accepted. */
  transcriptView?: TranscriptViewMode | typeof LEGACY_TRANSCRIPT_VIEW_MODE | typeof LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE | null
  /** Detail level for composer statistics and completed-Turn usage. */
  performanceUsage: PerformanceUsageMode
  /** Default destination for Chat HTTP(S) links. */
  linkOpening: LinkOpening
  /** Zone the message clocks read. */
  clockTimeZone: ClockTimeZone
}

/** Durable Chat schema; also the wire envelope the browser scope validates against. */
export const ChatSettingsFields = {
  linkOpening: z.union(['sidebar', 'new-tab']).default(DEFAULT_LINK_OPENING),
  performanceUsage: z.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
  clockTimeZone: z.union([...CLOCK_TIME_ZONES]).default(DEFAULT_CLOCK_TIME_ZONE),
  // Missing and unrecognized modes defer to the client's default.
  [TRANSCRIPT_VIEW_FIELD]: z.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).loose(),
}

/** Schema for shared configuration values. */
export const ChatSettingsSchema = z.object(ChatSettingsFields)
