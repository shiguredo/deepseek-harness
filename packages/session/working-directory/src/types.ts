/**
 * Projection type of the working-directory domain: the `workingDirectory` key
 * the session-projection table carries. This module is the package's pure-type
 * outlet — the service, its `fs`/`llm`/`agent` imports, and its `Context`
 * merge stay in `index.ts` — so client code can read the key through
 * `@deepseek-ai/dsh-working-directory/client` without dragging the host graph
 * into the client program.
 *
 * @module @deepseek-ai/dsh-working-directory/types
 */

import type {} from '@deepseek-ai/dsh-session-projection/types'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Recorded current directory for Session observations, or null when none is recorded. */
    workingDirectory: string | null
  }

  interface SessionProjectionStateMap {
    /** Last committed working directory, or null before an explicit value exists. */
    workingDirectory: string | null
  }
}
