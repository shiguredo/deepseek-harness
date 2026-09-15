/** Host half: durable namespace registration, validation, and index boot rows. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply } from '@deepseek-ai/dsh-client-ui-font-family'
import { FONT_SETTINGS_NAMESPACE } from '../src/font-settings.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** Collect the injection table the way an index render or boot payload does. */
function collect(ctx: Context): IndexInjection[] {
  const table: IndexInjection[] = []
  ctx.emit('webserver/index-inject', table)
  return table
}

/** Narrow the font row and return its script body. */
function scriptText(row: IndexInjection | undefined): string {
  if (row?.kind !== 'script') throw new Error('expected a script row')
  return row.text
}

describe('ui-font-family host', () => {
  it('registers, validates, and disposes the durable font namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = FONT_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({})
    await ctx.settings.update(ns, { fontFamily: '"Hiragino Sans", sans-serif' })
    expect(ctx.settings.get(ns)).toEqual({ fontFamily: '"Hiragino Sans", sans-serif' })
    await expect(ctx.settings.update(ns, { fontFamily: 'broken ; value' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { fontFamily: 'x'.repeat(257) })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })

  it('bootstraps only the durable family and drops the row when the field is cleared', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    // No stored family: the shipped theme stacks stay untouched.
    expect(collect(ctx)).toEqual([])
    await ctx.settings.update(FONT_SETTINGS_NAMESPACE, { fontFamily: '"Hiragino Sans", sans-serif' })
    const rows = collect(ctx)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'script', placement: 'body' })
    expect(scriptText(rows[0])).toContain(JSON.stringify('"Hiragino Sans", sans-serif'))
    expect(scriptText(rows[0])).toContain('--dsw-font-family')
    expect(scriptText(rows[0])).toContain('--ds-font-family-code')
    // A wholesale replace drops the field, so the row disappears again.
    await ctx.settings.replace(FONT_SETTINGS_NAMESPACE, {})
    expect(collect(ctx)).toEqual([])
    await fiber.dispose()
    expect(collect(ctx)).toEqual([])
  })

  it('contributes no row without a settings provider', async () => {
    const ctx = new Context()
    await ctx.plugin({ apply }).await()
    expect(collect(ctx)).toEqual([])
  })
})
