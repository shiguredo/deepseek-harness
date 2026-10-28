import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { PromptSection } from '@deepseek-ai/dsh-system-prompt'
import type { PreToolDecision } from '@deepseek-ai/dsh-tools'
import { afterEach, describe, expect, it } from 'vitest'
import * as GitPushGuard from '../src/index.ts'
import type { GuardState } from '../src/index.ts'

/** One recorded question request; the guard only ever asks one shape. */
interface QuestionRequest {
  readonly questions: readonly {
    readonly id: string
    readonly question: string
    readonly detail?: string
    readonly options?: readonly { readonly label: string }[]
  }[]
}

interface HarnessOptions {
  readonly answer?: 'Allow' | 'Reject' | 'child' | 'unavailable' | 'delegated' | 'object-error'
  readonly abortSignal?: AbortSignal
  readonly stored?: GuardState
  readonly rejection?: 401 | 403
}

interface FakeResponse {
  statusCode: number
  readonly headers: Record<string, string>
  body: string
  ended: boolean
  setHeader(name: string, value: string): void
  end(chunk?: string): void
}

interface FakeRequest {
  readonly method: string
  readonly url: string | undefined
  readonly headers: Record<string, string>
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array | string>
}

interface Harness {
  readonly ctx: Context
  readonly routes: WebRoute[]
  readonly sections: PromptSection[]
  readonly asks: QuestionRequest[]
  readonly stateFile: string
}

interface Execution {
  readonly name: string
  readonly arguments: unknown
  readonly agent?: { readonly session: { readonly id: string } }
  readonly signal: AbortSignal
}

const directories: string[] = []

/**
 * Mount the plugin on a bare Context with fake services; the state file and the
 * recorded contributions are the observable surface.
 * @param options - answer behavior and initial persisted state.
 * @returns the mounted harness.
 */
function harness(options: HarnessOptions = {}): Harness {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-git-push-guard-plugin-'))
  directories.push(directory)
  const stateFile = join(directory, 'state.json')
  if (options.stored !== undefined) writeFileSync(stateFile, JSON.stringify(options.stored))
  const routes: WebRoute[] = []
  const sections: PromptSection[] = []
  const asks: QuestionRequest[] = []
  const ctx = new Context()
  ctx.provide('webServer', {
    register(route: WebRoute) {
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
  })
  ctx.provide('connection', { requestRejection: () => options.rejection })
  ctx.provide('tools', {})
  ctx.provide('systemPrompt', {
    section(section: PromptSection) {
      sections.push(section)
      return () => { sections.splice(sections.indexOf(section), 1) }
    },
    getSectionOrder: () => 500,
  })
  ctx.provide('userQuestions', {
    async ask(request: QuestionRequest) {
      asks.push(request)
      if (options.abortSignal?.aborted === true) throw new Error('aborted')
      if (options.answer === 'child') throw new Error('a live child cannot open a human interaction')
      if (options.answer === 'unavailable') throw new Error('no user-questions answerer accepted the request')
      if (options.answer === 'delegated') throw new Error('session is owned by another live agent')
      if (options.answer === 'object-error') throw { message: 'opaque answerer failure' }
      const selected = options.answer === 'Reject' ? 'Reject' : 'Allow'
      return { answers: [{ id: 'git-push-guard', selected: [selected] }] }
    },
  })
  return { ctx, routes, sections, asks, stateFile }
}

async function mount(harnessed: Harness): Promise<void> {
  await harnessed.ctx.plugin(GitPushGuard, { stateFile: harnessed.stateFile })
}

function fakeRequest(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): FakeRequest {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  }
}

function fakeRawRequest(method: string, url: string, chunks: readonly string[], headers: Record<string, string>): FakeRequest {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk
    },
  }
}

function fakeResponse(): FakeResponse {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    ended: false,
    setHeader(name: string, value: string) { this.headers[name] = value },
    end(chunk?: string) {
      if (typeof chunk === 'string') this.body += chunk
      this.ended = true
    },
  }
}

function preExecute(ctx: Context, execution: Execution): Promise<PreToolDecision> {
  const dispatch = Reflect.get(ctx, 'waterfall') as (name: string, ...args: unknown[]) => Promise<PreToolDecision>
  return Reflect.apply(dispatch, ctx, ['tools/pre-execute', execution, () => Promise.resolve<PreToolDecision>({ kind: 'allow' })])
}

function pushExecution(command: string, sessionId = 'session-a', signal = new AbortController().signal): Execution {
  return { name: 'bash', arguments: { command }, agent: { session: { id: sessionId } }, signal }
}

function routeOf(harnessed: Harness): WebRoute {
  const route = harnessed.routes.find(candidate => candidate.path === '/push-guard/state')
  if (route === undefined) throw new Error('state route was not registered')
  return route
}

function callRoute(route: WebRoute, request: FakeRequest, response: FakeResponse): Promise<void> | void {
  const handler = Reflect.get(route, 'handler') as (...args: unknown[]) => Promise<void> | void
  return handler(request, response)
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('state route', () => {
  it('reports the default and captures one session value', async () => {
    const harnessed = harness({ stored: { default: true, sessions: {} } })
    await mount(harnessed)
    const route = routeOf(harnessed)

    const base = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state'), base)
    expect(base.statusCode).toBe(200)
    expect(JSON.parse(base.body)).toEqual({ default: true })

    const session = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state?session=session-a'), session)
    expect(JSON.parse(session.body)).toEqual({ default: true, session: true })
    expect(JSON.parse(readFileSync(harnessed.stateFile, 'utf8'))).toEqual({ default: true, sessions: { 'session-a': true } })
  })

  it('changes the default and one session independently', async () => {
    const harnessed = harness({ stored: { default: true, sessions: {} } })
    await mount(harnessed)
    const route = routeOf(harnessed)

    const changedDefault = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: false }, { 'content-type': 'application/json' }), changedDefault)
    expect(JSON.parse(changedDefault.body)).toEqual({ default: false })

    const changedSession = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: true, sessionId: 'session-a' }, { 'content-type': 'application/json' }), changedSession)
    expect(JSON.parse(changedSession.body)).toEqual({ default: false, session: true })

    const read = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state?session=session-a'), read)
    expect(JSON.parse(read.body)).toEqual({ default: false, session: true })
  })

  it('answers HEAD without a body and rejects unsupported requests', async () => {
    const harnessed = harness()
    await mount(harnessed)
    const route = routeOf(harnessed)

    const head = fakeResponse()
    await callRoute(route, fakeRequest('HEAD', '/push-guard/state'), head)
    expect(head.statusCode).toBe(200)
    expect(head.body).toBe('')

    const wrongType = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: true }), wrongType)
    expect(wrongType.statusCode).toBe(415)

    const badBody = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', 'not-an-object', { 'content-type': 'application/json' }), badBody)
    expect(badBody.statusCode).toBe(400)

    const emptyBody = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', undefined, { 'content-type': 'application/json' }), emptyBody)
    expect(emptyBody.statusCode).toBe(400)

    const wrongMethod = fakeResponse()
    await callRoute(route, fakeRequest('DELETE', '/push-guard/state'), wrongMethod)
    expect(wrongMethod.statusCode).toBe(405)
  })

  it('rejects an oversized body', async () => {
    const harnessed = harness({ stored: { default: true, sessions: {} } })
    await mount(harnessed)
    const response = fakeResponse()
    await callRoute(routeOf(harnessed), fakeRawRequest('POST', '/push-guard/state', ['x'.repeat(5000)], { 'content-type': 'application/json' }), response)
    expect(response.statusCode).toBe(400)
    expect(response.body).toContain('invalid JSON body')
  })

  it('validates the JSON body and accepts raw chunks', async () => {
    const harnessed = harness({ stored: { default: true, sessions: {} } })
    await mount(harnessed)
    const route = routeOf(harnessed)
    for (const body of [[], 'text']) {
      const response = fakeResponse()
      await callRoute(route, fakeRequest('POST', '/push-guard/state', body, { 'content-type': 'application/json' }), response)
      expect(response.statusCode).toBe(400)
      expect(response.body).toContain('body must be a JSON object')
    }
    const missing = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', {}, { 'content-type': 'application/json' }), missing)
    expect(missing.statusCode).toBe(400)
    expect(missing.body).toContain('enabled must be a boolean')
    const response = fakeResponse()
    await callRoute(route, fakeRawRequest('POST', '/push-guard/state', ['{"ena', 'bled":false}'], { 'content-type': 'application/json' }), response)
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('"default":false')
    const emptySession = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: true, sessionId: '' }, { 'content-type': 'application/json' }), emptySession)
    expect(emptySession.statusCode).toBe(200)
    expect(emptySession.body).toContain('"default":true')
  })

  it('answers a request without a URL from the bare route', async () => {
    const harnessed = harness({ stored: { default: true, sessions: {} } })
    await mount(harnessed)
    const request = fakeRequest('GET', '/push-guard/state')
    const response = fakeResponse()
    await callRoute(routeOf(harnessed), { ...request, url: undefined }, response)
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('"default":true')
  })

  it('applies the connection trust fence', async () => {
    const harnessed = harness({ rejection: 403 })
    await mount(harnessed)
    const response = fakeResponse()
    await callRoute(routeOf(harnessed), fakeRequest('GET', '/push-guard/state'), response)
    expect(response.statusCode).toBe(403)
  })
})

describe('tool guard', () => {
  it('passes calls that push nothing', async () => {
    const harnessed = harness()
    await mount(harnessed)
    expect(await preExecute(harnessed.ctx, pushExecution('git status'))).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(0)
    expect(await preExecute(harnessed.ctx, { name: 'read', arguments: { path: 'a' }, signal: new AbortController().signal })).toEqual({ kind: 'allow' })
  })

  it('asks the user and runs the push when allowed', async () => {
    const harnessed = harness({ answer: 'Allow' })
    await mount(harnessed)
    expect(await preExecute(harnessed.ctx, pushExecution('git push origin main'))).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(1)
    expect(harnessed.asks[0]?.questions[0]?.question).toContain('push')
  })

  it('leaves commit-creating commands unguarded', async () => {
    const harnessed = harness({ answer: 'Allow' })
    await mount(harnessed)
    for (const command of ['git commit -m x', 'git merge feature', 'git rebase main', 'git cherry-pick abc123']) {
      expect(await preExecute(harnessed.ctx, pushExecution(command))).toEqual({ kind: 'allow' })
    }
    expect(harnessed.asks).toHaveLength(0)
  })

  it('inspects the pwsh command argument on Windows', async () => {
    const harnessed = harness({ answer: 'Allow' })
    await mount(harnessed)
    const plain: Execution = { name: 'pwsh', arguments: { command: 'git push origin main' }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, plain)).toEqual({ kind: 'allow' })
    const callOperator: Execution = {
      name: 'pwsh',
      arguments: { command: '& "C:\\Program Files\\Git\\bin\\git.exe" push origin main' },
      agent: { session: { id: 'session-a' } },
      signal: new AbortController().signal,
    }
    expect(await preExecute(harnessed.ctx, callOperator)).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(2)
  })

  it('passes a pwsh call that pushes nothing', async () => {
    const harnessed = harness({ answer: 'Allow' })
    await mount(harnessed)
    const execution: Execution = { name: 'pwsh', arguments: { command: 'git status' }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, execution)).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(0)
  })

  it('inspects terminal_send text as well', async () => {
    const harnessed = harness({ answer: 'Allow' })
    await mount(harnessed)
    const execution: Execution = { name: 'terminal_send', arguments: { text: 'git push origin main' }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, execution)).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(1)
  })

  it('denies the push when the user rejects it', async () => {
    const harnessed = harness({ answer: 'Reject' })
    await mount(harnessed)
    const decision = await preExecute(harnessed.ctx, pushExecution('git push origin main'))
    expect(decision.kind).toBe('deny')
    expect(decision.kind === 'deny' ? decision.reason : '').toContain('rejected')
  })

  it('allows pushes without asking when the session has the guard off', async () => {
    const harnessed = harness({ stored: { default: true, sessions: { 'session-a': false } } })
    await mount(harnessed)
    expect(await preExecute(harnessed.ctx, pushExecution('git push origin main'))).toEqual({ kind: 'allow' })
    expect(harnessed.asks).toHaveLength(0)
  })

  it('resolves the default home path and guard default from config', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-git-push-guard-home-'))
    directories.push(directory)
    const previous = process.env.DSH_HOME
    process.env.DSH_HOME = directory
    try {
      const harnessed = harness()
      await harnessed.ctx.plugin(GitPushGuard, { defaultEnabled: false })
      const emit = Reflect.get(harnessed.ctx, 'emit') as (name: string, ...args: unknown[]) => unknown
      emit.call(harnessed.ctx, 'agent/created', { agent: { session: { id: 'session-c' } } })
      await Promise.resolve()
      expect(JSON.parse(readFileSync(join(directory, 'push-guard', 'state.json'), 'utf8'))).toEqual({ default: false, sessions: { 'session-c': false } })

      const noConfig = harness()
      await noConfig.ctx.plugin(GitPushGuard)
      const emitNoConfig = Reflect.get(noConfig.ctx, 'emit') as (name: string, ...args: unknown[]) => unknown
      emitNoConfig.call(noConfig.ctx, 'agent/created', { agent: { session: { id: 'session-d' } } })
      await Promise.resolve()
      expect(JSON.parse(readFileSync(join(directory, 'push-guard', 'state.json'), 'utf8'))).toEqual({ default: false, sessions: { 'session-c': false, 'session-d': false } })
    } finally {
      if (previous === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previous
    }
  })

  it('captures a new session from the current default', async () => {
    const harnessed = harness()
    await harnessed.ctx.plugin(GitPushGuard, { stateFile: harnessed.stateFile, defaultEnabled: false })
    const emit = Reflect.get(harnessed.ctx, 'emit') as (name: string, ...args: unknown[]) => unknown
    emit.call(harnessed.ctx, 'agent/created', { agent: { session: { id: 'session-b' } } })
    await Promise.resolve()
    emit.call(harnessed.ctx, 'agent/created', { agent: { session: { id: 'session-b' } } })
    await Promise.resolve()
    expect(JSON.parse(readFileSync(harnessed.stateFile, 'utf8'))).toEqual({ default: false, sessions: { 'session-b': false } })
    expect(await preExecute(harnessed.ctx, pushExecution('git push origin main', 'session-b'))).toEqual({ kind: 'allow' })
  })

  it('fails closed without an agent, for a subagent, and when the ask fails', async () => {
    const noAgent = harness({ answer: 'Allow' })
    await mount(noAgent)
    expect(await preExecute(noAgent.ctx, { name: 'bash', arguments: { command: 'git push origin main' }, signal: new AbortController().signal })).toMatchObject({ kind: 'deny' })

    const child = harness({ answer: 'child' })
    await mount(child)
    const childDecision = await preExecute(child.ctx, pushExecution('git push origin main'))
    expect(childDecision.kind === 'deny' ? childDecision.reason : '').toContain('subagent')

    const unavailable = harness({ answer: 'unavailable' })
    await mount(unavailable)
    const unavailableDecision = await preExecute(unavailable.ctx, pushExecution('git push origin main'))
    expect(unavailableDecision.kind === 'deny' ? unavailableDecision.reason : '').toContain('could not be asked')

    const delegated = harness({ answer: 'delegated' })
    await mount(delegated)
    const delegatedDecision = await preExecute(delegated.ctx, pushExecution('git push origin main'))
    expect(delegatedDecision.kind === 'deny' ? delegatedDecision.reason : '').toContain('subagent')

    const opaque = harness({ answer: 'object-error' })
    await mount(opaque)
    const opaqueDecision = await preExecute(opaque.ctx, pushExecution('git push origin main'))
    expect(opaqueDecision.kind === 'deny' ? opaqueDecision.reason : '').toContain('could not be asked')
  })

  it('passes through tools and argument forms that carry no shell command', async () => {
    const harnessed = harness()
    await mount(harnessed)
    const read: Execution = { name: 'read', arguments: { path: 'x' }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, read)).toEqual({ kind: 'allow' })
    const noArgs: Execution = { name: 'bash', arguments: null, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, noArgs)).toEqual({ kind: 'allow' })
    const numericCommand: Execution = { name: 'bash', arguments: { command: 42 }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, numericCommand)).toEqual({ kind: 'allow' })
    const numericPwshCommand: Execution = { name: 'pwsh', arguments: { command: 42 }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, numericPwshCommand)).toEqual({ kind: 'allow' })
    const numericText: Execution = { name: 'terminal_send', arguments: { text: 42 }, agent: { session: { id: 'session-a' } }, signal: new AbortController().signal }
    expect(await preExecute(harnessed.ctx, numericText)).toEqual({ kind: 'allow' })
  })

  it('reports cancellation when the call was aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const harnessed = harness({ abortSignal: controller.signal })
    await mount(harnessed)
    const decision = await preExecute(harnessed.ctx, pushExecution('git push origin main', 'session-a', controller.signal))
    expect(decision).toEqual({ kind: 'cancel' })
  })
})

describe('system prompt section', () => {
  it('describes the policy only while the session guard is on', async () => {
    const harnessed = harness()
    await mount(harnessed)
    const section = harnessed.sections[0]
    if (section === undefined) throw new Error('prompt section was not registered')
    const text = Reflect.get(section, 'text') as (context: unknown) => string
    expect(Reflect.apply(text, undefined, [{ agent: { session: { id: 'session-a' } } }])).toContain('Git push guard is enabled in this session')
    expect(Reflect.apply(text, undefined, [{}])).toBe('')
  })

  it('stays empty when the session guard is off', async () => {
    const harnessed = harness({ stored: { default: true, sessions: { 'session-a': false } } })
    await mount(harnessed)
    const section = harnessed.sections[0]
    if (section === undefined) throw new Error('prompt section was not registered')
    const text = Reflect.get(section, 'text') as (context: unknown) => string
    expect(Reflect.apply(text, undefined, [{ agent: { session: { id: 'session-a' } } }])).toBe('')
  })
})

describe('fiber teardown', () => {
  it('removes the state route, prompt section, and listeners with the plugin fiber', async () => {
    // The real prompt registry binds a section's disposal to the registering
    // fiber, so this teardown uses it instead of the harness's recording stub.
    const directory = mkdtempSync(join(tmpdir(), 'dsh-git-push-guard-teardown-'))
    directories.push(directory)
    const stateFile = join(directory, 'state.json')
    const routes: WebRoute[] = []
    const asks: QuestionRequest[] = []
    const ctx = new Context()
    ctx.provide('webServer', {
      register(route: WebRoute) {
        routes.push(route)
        return () => { routes.splice(routes.indexOf(route), 1) }
      },
    })
    ctx.provide('connection', { requestRejection: () => undefined })
    ctx.provide('tools', {})
    ctx.provide('userQuestions', {
      async ask(request: QuestionRequest) {
        asks.push(request)
        return { answers: [{ id: 'git-push-guard', selected: ['Allow'] }] }
      },
    })
    await ctx.plugin(SystemPrompt)
    const fiber = ctx.plugin(GitPushGuard, { stateFile })
    await fiber
    expect(routes).toHaveLength(1)
    const sectionNames = async (): Promise<string[]> =>
      (await ctx.systemPrompt.assemble({})).sections.map(section => section.name)
    expect(await sectionNames()).toContain('git-push-guard:policy')

    await fiber.dispose()

    expect(routes).toHaveLength(0)
    expect(await sectionNames()).not.toContain('git-push-guard:policy')
    expect(await preExecute(ctx, pushExecution('git push origin main'))).toEqual({ kind: 'allow' })
    expect(asks).toHaveLength(0)
  })
})
