/** The sign-in flows this composition offers, read once per mount. */

import { useEffect, useState } from 'react'
import type { ModelSignInFace } from './face.ts'
import type { SignInFlowView } from '../types.ts'

/**
 * Read the Host's flow list for a surface that renders one line about it.
 * @param list - the Remote callback that answers the list.
 * @returns the flows, or null until the first answer arrives.
 */
export function useFlows(list: ModelSignInFace['list']): readonly SignInFlowView[] | null {
  const [flows, setFlows] = useState<readonly SignInFlowView[] | null>(null)
  // The list is a face member, so it keeps its identity across renders; a
  // changed one is a different Remote and worth re-reading.
  useEffect(() => {
    let live = true
    void list().then((next) => { if (live) setFlows(next) }, () => {})
    return () => { live = false }
  }, [list])
  return flows
}
