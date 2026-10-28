/**
 * Client-namespace projection of the working-directory domain: a pure
 * re-export of this package's type outlet. Client code imports ONLY the
 * `client` namespace, so the service and its host-only imports never enter the
 * client program.
 *
 * @module @deepseek-ai/dsh-working-directory/client
 */

export type * from './types.ts'
