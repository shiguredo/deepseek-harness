/** Host half: the font-family config field's validation and index boot rows. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'
import { Config, apply } from '../src/index.ts'

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
  it('validates the font-family preference and keeps it absent by default', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    const { fiber } = configuration
    expect(plainConfig(fiber.config)).toEqual({ fontFamily: undefined })
    await configuration.update({ fontFamily: '"Hiragino Sans", sans-serif' })
    expect(plainConfig(fiber.config)).toEqual({ fontFamily: '"Hiragino Sans", sans-serif' })
    await expect(configuration.update({ fontFamily: 'broken ; value' })).rejects.toThrow()
    await expect(configuration.update({ fontFamily: 'x'.repeat(257) })).rejects.toThrow()
    await fiber.dispose()
  })

  it('bootstraps only the stored family and drops the row when the field is cleared', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    // No stored family: the shipped theme stacks stay untouched.
    expect(collect(ctx)).toEqual([])
    await configuration.update({ fontFamily: '"Hiragino Sans", sans-serif' })
    const rows = collect(ctx)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: 'script', placement: 'body' })
    expect(scriptText(rows[0])).toContain(JSON.stringify('"Hiragino Sans", sans-serif'))
    expect(scriptText(rows[0])).toContain('--dsw-font-family')
    expect(scriptText(rows[0])).toContain('--ds-font-family-code')
    // A wholesale replace drops the field, so the row disappears again.
    await configuration.replace({})
    expect(collect(ctx)).toEqual([])
    await configuration.fiber.dispose()
    expect(collect(ctx)).toEqual([])
  })

  it('contributes no row without a settings provider', async () => {
    const ctx = new Context()
    await ctx.plugin({ Config, apply }).await()
    expect(collect(ctx)).toEqual([])
  })
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))
