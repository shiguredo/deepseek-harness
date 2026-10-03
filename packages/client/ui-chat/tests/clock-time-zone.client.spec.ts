// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { stubConfigForm } from '@deepseek-ai/dsh-client-test-runtime'
import type { ChatSettings } from '../src/chat-settings.ts'
import { ClockTimeZonePolicy } from '../src/client/clock-time-zone.ts'

describe('ClockTimeZonePolicy', () => {
  it('keeps explicit choices live when a memory-only scope cannot persist them', () => {
    const host = stubConfigForm<ChatSettings>()
    host.publish({ mode: 'memory', status: 'ready' })
    const policy = new ClockTimeZonePolicy(host.scope)
    expect(policy.zone.getSnapshot()).toBe('local')
    policy.setZone('jst')
    expect(policy.zone.getSnapshot()).toBe('jst')
    expect(host.set).toHaveBeenCalledWith('clockTimeZone', 'jst')
    host.publish({ value: undefined, writable: false })
    expect(policy.zone.getSnapshot()).toBe('jst')
    policy.setZone('jst')
    expect(host.set).toHaveBeenCalledTimes(1)
  })

  it('adopts accepted Host settings at construction and after updates', () => {
    const host = stubConfigForm<ChatSettings>()
    host.publish({
      value: { linkOpening: 'sidebar', performanceUsage: 'detailed', clockTimeZone: 'utc' },
    })
    const policy = new ClockTimeZonePolicy(host.scope)
    expect(policy.zone.getSnapshot()).toBe('utc')
    host.publish({
      value: { linkOpening: 'sidebar', performanceUsage: 'detailed', clockTimeZone: 'local' },
    })
    expect(policy.zone.getSnapshot()).toBe('local')
  })

  it('releases its subscription when the consuming plugin unloads', () => {
    const host = stubConfigForm<ChatSettings>()
    const policy = new ClockTimeZonePolicy(host.scope)
    expect(host.listenerCount()).toBe(1)
    policy.dispose()
    expect(host.listenerCount()).toBe(0)
  })
})
