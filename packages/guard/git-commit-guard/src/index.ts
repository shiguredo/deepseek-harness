/**
 * Git commit guard: while enabled for a session, an agent's commit-creating Git
 * command does not run until the user answers a confirmation question in the
 * Web UI. The question names the exact command, so the user decides on the real
 * action rather than a pre-granted token.
 *
 * Two independent settings drive the decision. The sidebar panel changes the
 * default for new sessions; the composer chip changes one session only, and a
 * later default change never overrides it. Both are read and written through
 * one same-origin route and persisted as `{ default, sessions }` under the
 * Harness home.
 *
 * The user is the only approval channel: answers come from the human UI, and an
 * agent has no way to answer its own question.
 *
 * @module @deepseek-ai/dsh-git-commit-guard
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-questions'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { PreToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { commitSubcommandOf, commandDetailOf } from './commit-command.ts'
import { loadGuardState, saveGuardState, sessionEnabled, type MutableGuardState } from './state.ts'

export type { GuardState } from './state.ts'

/** Cordis function-plugin name. */
export const name = 'git-commit-guard'

/** The route carrier, the trust fence, the tool pipeline, the prompt, and the human answerer. */
export const inject = ['webServer', 'connection', 'tools', 'systemPrompt', 'userQuestions']

/** Plugin configuration. */
export interface Config {
  /** Absolute state file path; defaults to `$DSH_HOME/commit-guard/state.json`. */
  readonly stateFile?: string
  /** Whether a new session starts with the guard enabled. Defaults to true. */
  readonly defaultEnabled?: boolean
}

export const Config: z<Config> = z.object({
  stateFile: z.string(),
  defaultEnabled: z.boolean().default(true),
})

/** Same-origin endpoint the browser controls read and write. */
const STATE_ROUTE = '/commit-guard/state'

/** The toggle body is tiny; reject anything larger. */
const MAX_BODY_BYTES = 4096

/** Allow label that admits one commit. */
const APPROVE = 'Allow'

/** Allow label that keeps the commit blocked. */
const REJECT = 'Reject'

/** Model-facing policy statement contributed while the guard is enabled. */
const PROMPT_TEXT = 'Git commit guard is enabled in this session: commit-creating Git commands '
  + '(git commit, merge, rebase, cherry-pick, revert, am, commit-tree) do not run until the user answers the confirmation question '
  + 'the Harness shows right before the command runs. If the user rejects it, do not retry unless the user asks you to commit. '
  + 'The user can turn the guard off for this session from the guard chip in the composer.'

/** Model-facing denial when the user rejects the commit. */
const REJECTED_REASON = 'Git commit guard: the user rejected this commit, so nothing ran. Do not retry unless the user asks you to commit.'

/** Model-facing denial when no human answer is reachable. */
const UNAVAILABLE_REASON = 'Git commit guard: the user could not be asked to confirm this commit, so nothing ran.'

/** Model-facing denial for a call without an owning agent. */
const NO_AGENT_REASON = 'Git commit guard: a commit command without an owning agent is always blocked.'

/** Model-facing denial for a subagent call, which cannot open a human interaction. */
const CHILD_REASON = 'Git commit guard: a subagent cannot ask the user for commit confirmation, so the commit was blocked. '
  + 'Report the requested commit to the parent agent instead.'

/** Trust surface consumed here; the browser-side connection package owns the full type. */
interface ConnectionFence {
  /**
   * Apply the deployment's Host/Origin and authentication fence.
   * @param request - request headers from the HTTP request.
   * @returns the rejection status, or undefined when the route may accept it.
   */
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/**
 * Read the composition's Connection service, whose package owns the browser
 * side; this Host plugin consumes only its trust fence.
 * @param ctx - plugin context.
 * @returns the connection fence.
 */
function connectionOf(ctx: Context): ConnectionFence {
  return Reflect.get(ctx, 'connection') as ConnectionFence
}

/** Send one JSON response that the browser must not cache. */
function sendJson(response: ServerResponse, status: number, payload: unknown, includeBody = true): void {
  const body = JSON.stringify(payload)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('content-length', Buffer.byteLength(body))
  response.end(includeBody ? body : undefined)
}

/**
 * Read one size-bounded JSON request body.
 * @param request - incoming request.
 * @returns the parsed body.
 */
async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Read one boolean field from a parsed JSON object. */
function booleanField(body: object, field: string): boolean | undefined {
  const value: unknown = Reflect.get(body, field)
  return typeof value === 'boolean' ? value : undefined
}

/** Read one string field from a parsed JSON object. */
function stringField(body: object, field: string): string | undefined {
  const value: unknown = Reflect.get(body, field)
  return typeof value === 'string' ? value : undefined
}

/**
 * Answer the UI state route. GET without `session` reports the default; GET
 * with `?session=<id>` reports that session's own setting. POST `{ enabled }`
 * changes the default, and POST `{ enabled, sessionId }` changes one session.
 * @param state - live guard state.
 * @param persist - writes the state after a change.
 * @param connection - the deployment's trust fence.
 * @returns the HTTP route handler.
 */
function stateRoute(state: MutableGuardState, persist: () => void, connection: ConnectionFence) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const rejection = connection.requestRejection(request)
    if (rejection !== undefined) {
      response.statusCode = rejection
      response.end()
      return
    }
    const sessionId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('session') ?? ''
    if (request.method === 'GET' || request.method === 'HEAD') {
      const payload = sessionId === ''
        ? { default: state.default }
        : { default: state.default, session: sessionEnabled(state, sessionId, persist) }
      sendJson(response, 200, payload, request.method !== 'HEAD')
      return
    }
    if (request.method !== 'POST') {
      response.setHeader('allow', 'GET, HEAD, POST')
      response.statusCode = 405
      response.end()
      return
    }
    if (!/^application\/json\b/iu.test(request.headers['content-type'] ?? '')) {
      sendJson(response, 415, { error: 'content-type must be application/json' })
      return
    }
    try {
      const body = await readJsonBody(request)
      if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        sendJson(response, 400, { error: 'body must be a JSON object' })
        return
      }
      const enabled = booleanField(body, 'enabled')
      if (enabled === undefined) {
        sendJson(response, 400, { error: 'enabled must be a boolean' })
        return
      }
      const bodySessionId = stringField(body, 'sessionId')
      if (bodySessionId !== undefined && bodySessionId !== '') {
        state.sessions[bodySessionId] = enabled
        persist()
        sendJson(response, 200, { default: state.default, session: enabled })
        return
      }
      state.default = enabled
      persist()
      sendJson(response, 200, { default: state.default })
    } catch {
      sendJson(response, 400, { error: 'invalid JSON body' })
    }
  }
}

/**
 * Ask the user whether one pending commit may run.
 * @param ctx - plugin context carrying the human answerer.
 * @param execution - the pending tool call.
 * @param command - its shell command string.
 * @returns the pre-dispatch decision.
 */
async function confirmCommit(
  ctx: Context,
  agent: NonNullable<ToolExecution['agent']>,
  execution: ToolExecution,
  command: string,
): Promise<PreToolDecision> {
  try {
    const answer = await ctx.userQuestions.ask({
      agent,
      signal: execution.signal,
      questions: [{
        id: 'git-commit-guard',
        header: 'Git commit guard',
        question: 'Allow this Git commit?',
        detail: `The agent wants to run:\n\n${commandDetailOf(command)}`,
        options: [
          { label: APPROVE, description: 'Run this commit command.' },
          { label: REJECT, description: 'Keep the commit blocked.' },
        ],
      }],
    })
    const selected = answer.answers.flatMap(item => item.selected)
    if (selected.includes(APPROVE)) return { kind: 'allow' }
    return { kind: 'deny', reason: REJECTED_REASON }
  } catch (error) {
    if (execution.signal.aborted) return { kind: 'cancel' }
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('child') || message.includes('owned by another live agent')) return { kind: 'deny', reason: CHILD_REASON }
    return { kind: 'deny', reason: `${UNAVAILABLE_REASON} (${message})` }
  }
}

/**
 * Read the shell command string of a tool call this guard inspects.
 * @param execution - pending tool call.
 * @returns the command string, or undefined for every other tool.
 */
function commandOf(execution: ToolExecution): string | undefined {
  const field = execution.name === 'bash' ? 'command' : execution.name === 'terminal_send' ? 'text' : undefined
  if (field === undefined) return undefined
  const args = execution.arguments
  if (args === null || typeof args !== 'object') return undefined
  const value: unknown = Reflect.get(args, field)
  return typeof value === 'string' ? value : undefined
}

/**
 * Report the commit-creating command a pending tool call would run.
 * @param execution - pending tool call.
 * @returns the command string, or undefined when the call creates no commit.
 */
function commitCommand(execution: ToolExecution): string | undefined {
  const command = commandOf(execution)
  return command !== undefined && commitSubcommandOf(command) !== undefined ? command : undefined
}

/**
 * Register the guard while this plugin is active.
 * @param ctx - plugin context.
 * @param config - resolved plugin configuration.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const file = config.stateFile ?? dshHomePath('commit-guard', 'state.json')
  /* v8 ignore next -- Config normalization supplies defaultEnabled before apply; the fallback serves direct apply() calls. */
  const state = loadGuardState(file, config.defaultEnabled ?? true)
  const persist = (): void => { saveGuardState(file, state) }
  const connection = connectionOf(ctx)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: STATE_ROUTE,
    handler: stateRoute(state, persist, connection),
  }), 'git-commit-guard: state route')

  // A new session starts with the current default and then keeps its own choice.
  ctx.on('agent/created', ({ agent }) => {
    const sessionId = agent.session.id
    if (state.sessions[sessionId] !== undefined) return
    state.sessions[sessionId] = state.default
    persist()
  })

  ctx.on('tools/pre-execute', async (exec, next): Promise<PreToolDecision> => {
    const command = commitCommand(exec)
    if (command === undefined) return next()
    const agent = exec.agent
    // A commit intent without an owning session cannot be approved; fail closed.
    if (agent === undefined) return { kind: 'deny', reason: NO_AGENT_REASON }
    const sessionId = agent.session.id
    if (!sessionEnabled(state, sessionId, persist)) return next()
    const decision = await confirmCommit(ctx, agent, exec, command)
    if (decision.kind === 'allow') return next()
    return decision
  })

  ctx.systemPrompt.section({
    name: 'git-commit-guard:policy',
    order: ctx.systemPrompt.getSectionOrder('PLAN_POLICY') + 1,
    text: (context) => {
      const agent = context.agent
      if (agent === undefined) return ''
      return sessionEnabled(state, agent.session.id, persist) ? PROMPT_TEXT : ''
    },
  })
}
