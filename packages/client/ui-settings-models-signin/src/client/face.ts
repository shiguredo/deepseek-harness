/** Plain callbacks the Host Remote hands the Models page's sign-in section. */

import type { SignInAttemptView, SignInFlowView } from '../types.ts'

/** What the section and its attempt panel may do; every member is a Remote call. */
export interface ModelSignInFace {
  /** List every provider sign-in this composition offers. */
  readonly list: () => Promise<SignInFlowView[]>
  /** Start one attempt and return its first view. */
  readonly begin: (key: string, method: string) => Promise<SignInAttemptView>
  /** Read one attempt's current view. */
  readonly poll: (id: string) => Promise<SignInAttemptView | undefined>
  /** Answer the question the attempt waits on. */
  readonly answer: (id: string, promptId: number, value: string) => Promise<SignInAttemptView>
  /** Withdraw one attempt. */
  readonly cancel: (id: string) => Promise<SignInAttemptView>
  /** Forget the provider's stored credential record. */
  readonly signOut: (key: string) => Promise<void>
}
