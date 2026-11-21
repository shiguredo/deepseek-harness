/** The Models page's sign-in Remote: listing flows, driving one attempt, answering, cancelling, and signing out. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AuthorizationService from '@deepseek-ai/dsh-authorization'
import { credentialKey, credentialKeyId } from '@deepseek-ai/dsh-credentials'
import LocalCredentialProvider from '@deepseek-ai/dsh-credentials-local'
import { ModelSignIn } from '../src/index.ts'
import type { SignInAttemptView } from '../src/types.ts'

const KEY = credentialKey('llm-pi-ai', 'openai')
const KEY_TEXT = String(KEY)
const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

/** A composition with the authorization seam, a credential store, and one fake sign-in flow. */
async function bench(): Promise<Context> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-model-signin-'))
  dirs.push(dir)
  const ctx = new Context()
  await ctx.plugin(LocalCredentialProvider, { path: join(dir, '.credentials.yaml'), watch: false })
  await ctx.plugin(AuthorizationService)
  ctx.authorization.registerFlow({
    key: KEY,
    label: 'OpenAI (ChatGPT subscription)',
    methods: [{ id: 'oauth', label: 'Continue with ChatGPT' }],
    async run(session) {
      session.notify({ message: 'Complete sign-in in your browser.', url: 'https://auth.example/start' })
      const pasted = await session.prompt({ kind: 'text', message: 'Paste the redirect URL' })
      await session.commit({ kind: 'grant', payload: { token: pasted } })
    },
  })
  await ctx.plugin(ModelSignIn)
  return ctx
}

/** Poll one attempt until it reaches a phase the test can assert. */
async function waitFor(ctx: Context, id: string, wanted: SignInAttemptView['phase']): Promise<SignInAttemptView> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const view = ctx.modelSignIn.poll(id)
    if (view !== undefined && view.phase === wanted) return view
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error(`attempt ${id} never reached ${wanted}`)
}

describe('ModelSignIn', () => {
  it('lists the registered flow with its approved label and its stored credential state', async () => {
    const ctx = await bench()

    const [flow] = await ctx.modelSignIn.list()

    expect(flow).toMatchObject({
      key: KEY_TEXT,
      provider: credentialKeyId(KEY),
      label: 'OpenAI (ChatGPT subscription)',
      methods: [{ id: 'oauth', label: 'Continue with ChatGPT' }],
      signedIn: false,
    })
  })

  it('drives one attempt through its browser step, the pasted answer, and the committed record', async () => {
    const ctx = await bench()

    const started = ctx.modelSignIn.begin(KEY_TEXT, 'oauth')
    const waiting = await waitFor(ctx, started.id, 'waiting')

    expect(waiting.notices.map(notice => notice.message)).toEqual(['Complete sign-in in your browser.'])
    expect(waiting.notices[0]?.url).toBe('https://auth.example/start')
    expect(waiting.prompt).toMatchObject({ kind: 'text', message: 'Paste the redirect URL' })

    const prompt = waiting.prompt
    if (prompt === null) throw new Error('the flow asked nothing')
    ctx.modelSignIn.answer(started.id, prompt.id, 'http://127.0.0.1:1455/auth/callback?code=abc')
    const settled = await waitFor(ctx, started.id, 'succeeded')

    expect(settled.prompt).toBeNull()
    expect((await ctx.modelSignIn.list())[0]?.signedIn).toBe(true)
  })

  it('refuses an answer to a question it no longer asks', async () => {
    const ctx = await bench()

    const started = ctx.modelSignIn.begin(KEY_TEXT, 'oauth')
    await waitFor(ctx, started.id, 'waiting')

    expect(() => ctx.modelSignIn.answer(started.id, 999, 'late')).toThrow('no longer asks that question')
    ctx.modelSignIn.cancel(started.id)
  })

  it('cancels a running attempt and leaves no credential behind', async () => {
    const ctx = await bench()

    const started = ctx.modelSignIn.begin(KEY_TEXT, 'oauth')
    await waitFor(ctx, started.id, 'waiting')
    const cancelled = ctx.modelSignIn.cancel(started.id)

    expect(cancelled.phase).toBe('cancelled')
    await new Promise(resolve => setTimeout(resolve, 20))
    expect((await ctx.modelSignIn.list())[0]?.signedIn).toBe(false)
  })

  it('signs out by forgetting the stored record, and refuses while an attempt runs', async () => {
    const ctx = await bench()
    const started = ctx.modelSignIn.begin(KEY_TEXT, 'oauth')
    const waiting = await waitFor(ctx, started.id, 'waiting')

    await expect(ctx.modelSignIn.signOut(KEY_TEXT)).rejects.toThrow('still running')
    ctx.modelSignIn.cancel(started.id)
    await new Promise(resolve => setTimeout(resolve, 20))

    await ctx.modelSignIn.signOut(KEY_TEXT)
    expect((await ctx.modelSignIn.list())[0]?.signedIn).toBe(false)
    expect(waiting.prompt).not.toBeNull()
  })
})
