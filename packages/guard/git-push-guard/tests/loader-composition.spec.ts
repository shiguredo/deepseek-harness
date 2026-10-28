/**
 * REAL-composition proof: the shipped guard row boots through the vendored
 * Loader beside the real Agent, prompt, tools, and native executor services. A
 * push is blocked or delegated through the real pre-execute pipeline, a commit
 * passes untouched, the state route persists a choice, and an assembled request
 * carries the push policy only while the Session's guard is on.
 *
 * Only the two sides the guard cannot own in-process are doubled: the Web
 * carrier that serves the state route, and the human who answers the question.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry, { assembleContextFor } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { unsupportedInbox, unsupportedModel } from '@deepseek-ai/dsh-agent-loop-testkit'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native'
import { defineContentToolFixture } from '@deepseek-ai/dsh-tool-testkit'
import ToolsService from '@deepseek-ai/dsh-tools'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import * as GitPushGuard from '../src/index.ts'

/** One recorded question request; the guard only ever asks one shape. */
interface QuestionRequest {
  readonly questions: readonly {
    readonly id: string
    readonly question: string
    readonly detail?: string
    readonly options?: readonly { readonly label: string }[]
  }[]
}

/** Answers the fake Web surface returns, one per question. */
type Answer = 'Allow' | 'Reject'

interface FakeResponse {
  statusCode: number
  readonly headers: Record<string, string>
  body: string
  setHeader(name: string, value: string): void
  end(chunk?: string): void
}

interface FakeRequest {
  readonly method: string
  readonly url: string
  readonly headers: Record<string, string>
  [Symbol.asyncIterator](): AsyncIterator<string>
}

interface Composition {
  readonly ctx: Context
  readonly routes: WebRoute[]
  readonly asks: QuestionRequest[]
  readonly pushed: string[]
  readonly agent: Agent
  readonly stateFile: string
  readonly answers: Answer[]
}

let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  vi.restoreAllMocks()
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
  root = undefined
})

/**
 * Build one real Agent fixture the registry can announce and the pipeline can
 * scope.
 * @param ctx - the booted composition context.
 * @returns the announced agent.
 */
async function announceAgent(ctx: Context): Promise<Agent> {
  const scope = ctx.plugin(() => {})
  const id = SessionId('push-guard-agent')
  const session = Session.create(id)
  const agent: Agent = {
    id,
    options: {},
    session,
    model: unsupportedModel(),
    inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await ctx.agents.register(agent)
  return agent
}

/**
 * Boot the shipped rows through the real Loader, provide the Web carrier and
 * the human answerer the guard cannot own in-process, then announce one Agent
 * and register the two shell tool fixtures the guard inspects.
 * @returns the booted composition and its recorded interactions.
 */
async function boot(): Promise<Composition> {
  root = mkdtempSync(join(tmpdir(), 'dsh-git-push-guard-loader-'))
  const stateFile = join(root, 'state.json')
  const answers: Answer[] = []
  const asks: QuestionRequest[] = []
  const routes: WebRoute[] = []
  const pushed: string[] = []
  writeFileSync(join(root, 'cordis.yml'), [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-tool-executor-native'",
    "- name: '@deepseek-ai/dsh-git-push-guard'",
    '  config:',
    `    stateFile: ${JSON.stringify(stateFile)}`,
    '',
  ].join('\n'))
  context = new Context()
  context.baseUrl = `${pathToFileURL(root).href}/`
  context.provide('webServer', {
    register(route: WebRoute) {
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
  })
  context.provide('connection', { requestRejection: () => undefined })
  context.provide('userQuestions', {
    async ask(request: QuestionRequest) {
      asks.push(request)
      const answer = answers.shift() ?? 'Reject'
      return { answers: [{ id: 'git-push-guard', selected: [answer] }] }
    },
  })
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolsService],
    ['@deepseek-ai/dsh-tool-executor-native', NativeExecutor],
    ['@deepseek-ai/dsh-git-push-guard', GitPushGuard],
  ])
  const internal = context.loader.internal
  if (internal === undefined) throw new Error('Loader module importer is unavailable')
  // Replace only the module importer: every other Loader concern stays real.
  vi.spyOn(internal, 'import').mockImplementation(async (specifier: string) => {
    if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
    return modules.get(specifier)
  })
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(join(root, 'cordis.yml')).href } })
  await context.loader.await()
  const unloaded = [...context.loader.entries()]
    .filter(entry => entry.fiber === undefined && !entry.disabled)
    .map(entry => entry.options.name)
  expect(unloaded).toEqual([])

  for (const name of ['bash', 'pwsh']) {
    context.tools.register(defineContentToolFixture({
      name,
      description: `Fixture standing in for the ${name} tool.`,
      parameters: { command: { type: 'string', required: true, description: 'Command text.' } },
      async execute(args: { command: string }) {
        pushed.push(args.command)
        return [{ type: 'text', text: 'ran' }]
      },
    }))
  }
  const agent = await announceAgent(context)
  return { ctx: context, routes, asks, pushed, agent, stateFile, answers }
}

/**
 * Run one fixture shell call through the real tool pipeline.
 * @param ctx - the booted composition.
 * @param agent - owning agent.
 * @param name - fixture tool name.
 * @param command - command text the guard inspects.
 * @returns the single settled tool result.
 */
async function execute(
  ctx: Context,
  agent: Agent,
  name: string,
  command: string,
): Promise<{ readonly isError: boolean; readonly content: readonly { readonly type: string; readonly text?: string }[] }> {
  const batch = await ctx.tools.execute({
    calls: [{ type: 'tool-call', name, id: ToolCallId(`${name}-call`), arguments: JSON.stringify({ command }) }],
    signal: new AbortController().signal,
    agent,
  })
  const result = batch.results[0]?.result
  if (result === undefined) throw new Error('the fixture call produced no result')
  return result
}

/** Read the joined text of one settled result. */
function resultText(result: { readonly content: readonly { readonly type: string; readonly text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n')
}

function fakeRequest(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): FakeRequest {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield JSON.stringify(body)
    },
  }
}

function fakeResponse(): FakeResponse {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name: string, value: string) { this.headers[name] = value },
    end(chunk?: string) { if (typeof chunk === 'string') this.body += chunk },
  }
}

/**
 * Find the state route the real plugin registered on the fake carrier.
 * @param routes - routes the fake Web carrier recorded.
 * @returns the route.
 */
function stateRoute(routes: readonly WebRoute[]): WebRoute {
  const route = routes.find(candidate => candidate.path === '/push-guard/state')
  if (route === undefined) throw new Error('the push guard registered no state route')
  return route
}

/**
 * Call one state route handler.
 * @param route - the registered route.
 * @param request - fake request.
 * @param response - fake response.
 * @returns the handler's completion.
 */
function callRoute(route: WebRoute, request: FakeRequest, response: FakeResponse): Promise<void> | void {
  const handler = Reflect.get(route, 'handler') as (...args: unknown[]) => Promise<void> | void
  return handler(request, response)
}

describe('real Loader composition', () => {
  it('blocks a rejected push before dispatch and runs an allowed one', async () => {
    const harness = await boot()
    harness.answers.push('Reject')
    const rejected = await execute(harness.ctx, harness.agent, 'bash', 'git push origin main')
    expect(harness.pushed).toEqual([])
    expect(rejected.isError).toBe(true)
    expect(resultText(rejected)).toContain('the user rejected this push')
    expect(harness.asks).toHaveLength(1)
    expect(harness.asks[0]?.questions[0]?.question).toBe('Allow this Git push?')

    harness.answers.push('Allow')
    const allowed = await execute(harness.ctx, harness.agent, 'bash', 'git push origin main')
    expect(harness.pushed).toEqual(['git push origin main'])
    expect(allowed.isError).toBe(false)
    expect(harness.asks).toHaveLength(2)
  })

  it('leaves commit-creating commands unguarded', async () => {
    const harness = await boot()
    for (const command of ['git commit -m x', 'git merge feature']) {
      const result = await execute(harness.ctx, harness.agent, 'bash', command)
      expect(result.isError).toBe(false)
    }
    expect(harness.pushed).toEqual(['git commit -m x', 'git merge feature'])
    expect(harness.asks).toEqual([])
  })

  it('guards the pwsh tool and Windows command forms', async () => {
    const harness = await boot()
    harness.answers.push('Reject')
    const rejected = await execute(harness.ctx, harness.agent, 'pwsh', '& "C:\\Program Files\\Git\\bin\\git.exe" push origin main')
    expect(harness.pushed).toEqual([])
    expect(rejected.isError).toBe(true)
    expect(harness.asks).toHaveLength(1)
  })

  it('persists the Session switch through the real state route', async () => {
    const harness = await boot()
    const route = stateRoute(harness.routes)

    const read = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state'), read)
    expect(read.statusCode).toBe(200)
    expect(JSON.parse(read.body)).toEqual({ default: true })

    const write = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: false }, { 'content-type': 'application/json' }), write)
    expect(write.statusCode).toBe(200)
    expect(JSON.parse(readFileSync(harness.stateFile, 'utf8'))).toMatchObject({ default: false })

    // The announced Session captured the earlier default and keeps its own choice.
    const captured = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state?session=push-guard-agent'), captured)
    expect(JSON.parse(captured.body)).toEqual({ default: false, session: true })

    const sessionWrite = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: false, sessionId: 'push-guard-agent' }, { 'content-type': 'application/json' }), sessionWrite)
    expect(JSON.parse(sessionWrite.body)).toEqual({ default: false, session: false })

    const sessionRead = fakeResponse()
    await callRoute(route, fakeRequest('GET', '/push-guard/state?session=push-guard-agent'), sessionRead)
    expect(JSON.parse(sessionRead.body)).toEqual({ default: false, session: false })

    // The recorded Session choice keeps the next push unguarded without asking.
    harness.answers.push('Allow')
    const result = await execute(harness.ctx, harness.agent, 'bash', 'git push')
    expect(result.isError).toBe(false)
    expect(harness.asks).toEqual([])
  })

  it('contributes the push policy to an assembled request only while enabled', async () => {
    const harness = await boot()
    const enabled = await harness.ctx.systemPrompt.assemble(assembleContextFor(harness.agent))
    expect(enabled.sections.map(section => section.text).join('\n')).toContain('Git push guard is enabled in this session')

    const route = stateRoute(harness.routes)
    const write = fakeResponse()
    await callRoute(route, fakeRequest('POST', '/push-guard/state', { enabled: false, sessionId: 'push-guard-agent' }, { 'content-type': 'application/json' }), write)
    const disabled = await harness.ctx.systemPrompt.assemble(assembleContextFor(harness.agent))
    expect(disabled.sections.map(section => section.text).join('\n')).not.toContain('Git push guard is enabled in this session')
  })
})
