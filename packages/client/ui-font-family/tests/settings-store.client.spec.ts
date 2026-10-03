/** Font row slot store: the snapshot mirror and its revision guard. */
import { describe, expect, it } from 'vitest'
import { createFontFamilyRowStore } from '../src/client/settings-store.ts'

describe('createFontFamilyRowStore', () => {
  it('init shape: empty family with revision at -1', () => {
    const store = createFontFamilyRowStore().create()
    expect(store.getSnapshot()).toEqual({ fontFamily: '', revision: -1 })
  })

  it('sync mirrors the family; the revision guard drops stale and duplicate writes', () => {
    const store = createFontFamilyRowStore().create()
    store.actions.sync('"Hiragino Sans"', 3)
    expect(store.getSnapshot()).toEqual({ fontFamily: '"Hiragino Sans"', revision: 3 })
    store.actions.sync('stale', 2)
    store.actions.sync('stale', 3)
    expect(store.getSnapshot().fontFamily).toBe('"Hiragino Sans"')
    expect(store.getSnapshot().revision).toBe(3)
  })
})
