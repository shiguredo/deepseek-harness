/** Message-clock zone preference with process-local choices on memory-only settings scopes. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CLOCK_TIME_ZONE_FIELD, DEFAULT_CLOCK_TIME_ZONE, type ChatSettings, type ClockTimeZone } from '../chat-settings.ts'

/** Shared live preference for the settings row and every rendered message clock. */
export class ClockTimeZonePolicy {
  private readonly unsubscribe: () => void
  /** Current choice, reconciled with accepted Host settings when available. */
  readonly zone = createSnapshotStore<ClockTimeZone>(DEFAULT_CLOCK_TIME_ZONE)

  /** @param host - Chat settings scope, durable on loopback and memory-only elsewhere. */
  constructor(private readonly host: ConfigForm<ChatSettings>) {
    const adopt = (): void => {
      const accepted = host.getSnapshot().value?.[CLOCK_TIME_ZONE_FIELD]
      if (accepted !== undefined) this.zone.set(accepted)
    }
    this.unsubscribe = host.subscribe(adopt)
    adopt()
  }

  /** Release the accepted-value subscription. */
  dispose(): void { this.unsubscribe() }

  /**
   * Publish a choice immediately and persist it when the scope supports writes.
   * @param zone - Zone the message clocks should read.
   */
  setZone(zone: ClockTimeZone): void {
    if (zone === this.zone.getSnapshot()) return
    this.zone.set(zone)
    void this.host.set(CLOCK_TIME_ZONE_FIELD, zone)
  }
}
