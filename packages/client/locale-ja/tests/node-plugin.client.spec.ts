/** The node half exists so the Loader can mount the bundle row; its empty apply must stay callable. */
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

describe('locale-ja node half', () => {
  it('is a callable no-op plugin body', () => {
    expect(() => { apply() }).not.toThrow()
  })
})
