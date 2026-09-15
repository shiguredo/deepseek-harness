/**
 * Font row slot store: a mirror of the durable font section. The plugin's
 * apply-world scope listener is the only writer; the row component reads via
 * props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

/** Store state mirrored from the font settings scope. */
export interface FontFamilyRowState {
  /** Persisted font-family list; empty means the default stacks. */
  fontFamily: string
  /** Scope revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type FontFamilyRowActions = {
  sync: (draft: FontFamilyRowState, fontFamily: string, revision: number) => void
}

/**
 * Declares the Font row state and write surface.
 * @returns the store handle.
 */
export function createFontFamilyRowStore(): EngineStoreHandle<FontFamilyRowState, FontFamilyRowActions> {
  return defineStore({
    init: (): FontFamilyRowState => ({ fontFamily: '', revision: -1 }),
    actions: {
      sync: (d, fontFamily: string, revision: number) => {
        if (revision <= d.revision) return
        d.fontFamily = fontFamily
        d.revision = revision
      },
    },
  })
}
