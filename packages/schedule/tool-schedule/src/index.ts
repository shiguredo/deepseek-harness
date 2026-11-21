/**
 * Model-facing `schedule_create`, `schedule_list`, `schedule_view`, and
 * `schedule_edit` tools over the Host `ctx.schedule` service. Mounting the
 * plugin registers them in the mounting scope, so a preset decides which
 * agents receive them. Tasks belong to the Host, not to a Session: the tools
 * read and change any task by id, and only the delivery target names a Session.
 * @module @deepseek-ai/dsh-tool-schedule
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
// Type-only: make `ctx.get('agentPresets')` resolve to the preset roster when
// composed. A rosterless deployment records no preset for a created Session.
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { delegationDepthOf } from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolRunContext } from '@deepseek-ai/dsh-tools'
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_TITLE_LENGTH,
  MIN_EVERY_INTERVAL_SECONDS,
  ScheduleInputError,
  formatScheduleLocalTime,
} from '@deepseek-ai/dsh-schedule'
import type { ScheduleId } from '@deepseek-ai/dsh-schedule/client'
import type {
  InternalScheduleError, ScheduleEditRequest, ScheduleModelSelection, ScheduleTarget, ScheduleTargetRequest,
  ScheduleToolError, ScheduleCatalogEntry, ScheduleDeliveryReceipt, ScheduleRecord, SubagentSessionError,
} from '@deepseek-ai/dsh-schedule'
import { brandString } from '@deepseek-ai/dsh-brand'

/** Plugin name registered with the Loader. */
export const name = 'tool-schedule'

/** Host services this plugin consumes. The Schedule service is resolved per
 * scope, so a preset that declares this plugin stays inert while the shipped
 * composition keeps that service off. */
export const inject = ['tools', 'systemPrompt']

const MODEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    provider: { type: 'string', required: true },
    model: { type: 'string', required: true },
    reasoningEffort: { type: 'string' },
  },
} as const

const SESSION_CREATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cwd: { type: 'string' },
    agentPreset: { type: 'string' },
    model: MODEL_SCHEMA,
  },
} as const

const TARGET_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', required: true, const: 'session' },
        sessionId: { type: 'string', required: true },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', required: true, const: 'new_once' },
        sessionId: { type: 'string', required: true },
        create: { ...SESSION_CREATE_SCHEMA, required: true },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: { type: 'string', required: true, const: 'new' },
        create: { ...SESSION_CREATE_SCHEMA, required: true },
      },
    },
  ],
} as const

const DELIVERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scheduledAt: { type: 'string', required: true },
    deliveredAt: { type: 'string', required: true },
    targetSessionId: { type: 'string', required: true },
  },
} as const

const TASK_PROPERTIES = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    title: { type: 'string', required: true },
    prompt: { type: 'string', required: true },
    scheduledAt: { type: 'string', required: true },
    scheduledAtLocal: { type: 'string', required: true },
    target: { ...TARGET_SCHEMA, required: true },
    status: { type: 'string', required: true, enum: ['active', 'paused', 'ended'] },
    updatedAt: { type: 'string' },
    lastDelivery: DELIVERY_SCHEMA,
  },
} as const

const TASK_SCHEMA = {
  oneOf: [
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'rrule' }, rrule: { type: 'string', required: true } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'cron' }, expression: { type: 'string', required: true }, timeZone: { type: 'string', required: true } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'every' }, everySeconds: { type: 'integer', required: true } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'after' }, afterSeconds: { type: 'integer', required: true } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'at' } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'daily' }, time: { type: 'string', required: true }, timeZone: { type: 'string', required: true } } },
    { ...TASK_PROPERTIES, properties: { ...TASK_PROPERTIES.properties, kind: { type: 'string', required: true, const: 'weekly' }, time: { type: 'string', required: true }, timeZone: { type: 'string', required: true }, weekdays: { type: 'array', required: true, items: { type: 'integer' } } } },
  ],
} as const

const LIST_PAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: { type: 'array', required: true, items: TASK_SCHEMA },
    shown: { type: 'integer', required: true },
    total: { type: 'integer', required: true },
    limit: { type: 'integer', required: true },
    offset: { type: 'integer', required: true },
  },
} as const

const NOT_FOUND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    code: { type: 'string', required: true, const: 'schedule_not_found' },
  },
} as const

const DELETED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    deleted: { type: 'boolean', required: true, const: true },
  },
} as const

const CONFLICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', required: true },
    code: { type: 'string', required: true, const: 'schedule_conflict' },
  },
} as const

/** Errors every tool can return: a delegated caller and a withheld failure. */
const CALLER_ERRORS = ['subagent_session', 'internal_error'] as const

/** Errors of a new title, prompt, recurrence, rule selector, or creation model. */
const CREATE_ERRORS = [
  'invalid_selector', 'invalid_prompt', 'invalid_rule', 'invalid_time_zone', 'not_future', 'frequency_too_high',
  'model_unavailable', ...CALLER_ERRORS,
] as const

/** Errors of an invalid page request. */
const LIST_ERRORS = ['invalid_rule', ...CALLER_ERRORS] as const

/** An update accepts the same field, selector, and creation-model failures as a create. */
const EDIT_ERRORS = CREATE_ERRORS

/** Error result of one tool, limited to the codes that its output schema declares. */
interface DeclaredError<C extends ScheduleToolError['code']> {
  readonly code: C
  readonly message: string
}

/** Build the exact two-field error schema of one tool from the codes it can return. */
function errorSchema<const C extends ScheduleToolError['code']>(codes: readonly C[]) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      code: { type: 'string', required: true, enum: codes },
      message: { type: 'string', required: true },
    },
  } as const
}

const CREATE_OUTPUT_SCHEMA = { oneOf: [TASK_SCHEMA, errorSchema(CREATE_ERRORS)] } as const
const LIST_OUTPUT_SCHEMA = { oneOf: [LIST_PAGE_SCHEMA, errorSchema(LIST_ERRORS)] } as const
const VIEW_OUTPUT_SCHEMA = { oneOf: [TASK_SCHEMA, NOT_FOUND_SCHEMA, errorSchema(CALLER_ERRORS)] } as const
const EDIT_OUTPUT_SCHEMA = {
  oneOf: [TASK_SCHEMA, DELETED_SCHEMA, NOT_FOUND_SCHEMA, CONFLICT_SCHEMA, errorSchema(EDIT_ERRORS)],
} as const

const MANAGEMENT_AUTHORIZATION =
  'Only create or modify scheduled tasks at the user\'s explicit request; '
  + 'prior explicit user authorization for the running scheduled task remains valid.'

const CREATE_DESCRIPTION =
  'Create a scheduled task. At each occurrence of rrule, prompt is delivered to the target session '
  + 'as a scheduled message from the user. Provider, model, and reasoning_effort select the model of the sessions '
  + 'that a new_once or new target creates. '
  + 'The result includes the task id and the next occurrence as scheduledAt in UTC '
  + 'and scheduledAtLocal in the zone of rrule. '
  + 'After downtime, only the latest missed occurrence is delivered. Delivery can repeat after a crash.'

const LIST_DESCRIPTION =
  'List scheduled tasks, including tasks created from other sessions. Active tasks come first, ordered by scheduledAt.'

const VIEW_DESCRIPTION = 'View one scheduled task by id.'

const EDIT_DESCRIPTION = 'Update, pause, resume, or delete one scheduled task by id. '
  + 'Supplying provider, model, and reasoning_effort without target changes the model of the sessions this task creates. '
  + 'Deleting does not retract queued messages.'

const TITLE_HELP = `Task name of at most ${MAX_TITLE_LENGTH} characters in the user's language: action plus object. `
  + 'Omit timing, status, ids, and bracketed suffixes.'

const RRULE_HELP =
  'Supported RFC 5545 subset: one DTSTART line, a newline, and one RRULE line. '
  + 'DTSTART ends in Z for UTC or carries TZID with an IANA time zone; '
  + 'a fixed offset such as UTC+5 is Etc/GMT-5, with the sign reversed. '
  + 'DTSTART must name an existing local time. A TZID rule keeps local clock time across daylight-saving changes; '
  + 'generated nonexistent local times are skipped, and repeated ones occur once, at the earlier instant. '
  + 'DTSTART may be in the past; delivery starts with the first occurrence after creation. '
  + 'A one-time delivery is RRULE:FREQ=DAILY;COUNT=1. '
  + 'No SECONDLY; BYSECOND takes one value. COUNT is at most 1000; use UNTIL for longer rules. '
  + 'MINUTELY and HOURLY accept no BY parts, so select clock times with DAILY or WEEKLY plus BYHOUR and BYMINUTE. '
  + 'BYMONTHDAY and ordinal BYDAY require MONTHLY or YEARLY; BYYEARDAY and BYWEEKNO require YEARLY. '
  + 'Ordinal BYDAY cannot combine with BYWEEKNO. Each FREQ period allows at most 10080 candidates before BYSETPOS, '
  + 'which accepts at most 31 values. '
  + 'UNTIL is a UTC instant ending in Z. '
  + 'Example: "DTSTART;TZID=Asia/Singapore:20260901T080000\\nRRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1"'

const TARGET_CHOICES = ['this_session', 'new_once', 'new'] as const

/**
 * Describe the target choices, naming the configured spacing of `new` deliveries when it exceeds the one-minute
 * spacing of every task.
 * @param newSessionIntervalSeconds - Effective `newSessionIntervalSeconds` of the Host Schedule service.
 * @returns The `target` parameter description.
 */
function targetHelp(newSessionIntervalSeconds: number): string {
  const spacing = newSessionIntervalSeconds <= MIN_EVERY_INTERVAL_SECONDS
    ? ''
    : newSessionIntervalSeconds % 60 === 0
      ? `, at most once every ${newSessionIntervalSeconds / 60} minutes`
      : `, at most once every ${newSessionIntervalSeconds} seconds`
  return 'this_session delivers to this session; '
    + 'new_once delivers to the same new session every time, opened at the first delivery; new opens a different '
    + `new session for every delivery${spacing}. New sessions use this session's working directory and preset, `
    + 'and any model selected by provider, model, and reasoning_effort. '
    + 'With this_session or new_once, a delivery waits until the previous one finishes, and only the latest occurrence '
    + 'that passed meanwhile is delivered. '
    + 'Use this_session for reminders and for follow-ups to this conversation; use new_once or new for independent work, '
    + 'such as a recurring report, and whenever the user asks for a new conversation.'
}

/** Edit parameters that only an update accepts. */
const PATCH_FIELDS = ['title', 'prompt', 'rrule', 'target', 'active', 'provider', 'model', 'reasoning_effort'] as const

const PROVIDER_HELP = 'Provider id of the model used for each session that a new_once or new target creates; '
  + 'requires model. Omit both to use the default model. An existing session target keeps its own model.'

const MODEL_HELP = 'Model id within that provider; requires provider.'

const REASONING_EFFORT_HELP = 'Reasoning effort id for the selected model; requires provider and model. '
  + 'Omit to use the model\'s default.'

/** Deterministic model content for every canonical Schedule value. */
function renderValue(_args: unknown, value: unknown): ContentBlock[] {
  // The ToolRuntime has already validated the value against the lossless-JSON output schema.
  const text = JSON.stringify(value)
  return [{ type: 'text', text }]
}

/** Authoritative timing and management fields, without Host delivery bookkeeping. */
type ModelTask = ScheduleRecord & Pick<ScheduleCatalogEntry, 'target' | 'status' | 'updatedAt'> & {
  readonly scheduledAtLocal: string
  readonly lastDelivery?: Pick<ScheduleDeliveryReceipt, 'scheduledAt' | 'deliveredAt' | 'targetSessionId'>
}

/** Preserve timing, destination, and edit revision while withholding Host bookkeeping. */
function modelTask(task: ScheduleCatalogEntry): ModelTask {
  const { involvedSessionIds: _involved, createdAt: _created, executionActive: _execution,
    deliveryFloorEndsAt: _floor, lastDelivery, ...record } = task
  return {
    ...record, scheduledAtLocal: formatScheduleLocalTime(task, task.scheduledAt),
    ...lastDelivery === undefined ? {} : { lastDelivery: {
      scheduledAt: lastDelivery.scheduledAt, deliveredAt: lastDelivery.deliveredAt, targetSessionId: lastDelivery.targetSessionId,
    } },
  }
}

/** Pure generic pending card. */
function present(title: string, kind: 'read' | 'other', rawInput?: unknown): GenericCallView {
  return { card: 'generic', title, kind, ...rawInput === undefined ? {} : { rawInput } }
}

/** Stable error for failures not safe to expose. */
function internalError(): InternalScheduleError {
  return { code: 'internal_error', message: 'The schedule operation failed.' }
}

/**
 * Run one Schedule operation for the root Agent that dispatched the call.
 *
 * A delegated subagent cannot use scheduled tasks, so every tool refuses it here even when its preset exposes the
 * tool. An input error keeps its code when the tool declares that code; every other operation failure becomes
 * `internal_error`. An invalid runtime delegation depth is a caller defect and throws its `SubagentError`.
 * @param exec - Run context of the call.
 * @param codes - Error codes of the tool.
 * @param operation - Service call for the calling Agent.
 * @returns The operation result, or an error with a declared code.
 */
async function runForCaller<T, const C extends ScheduleToolError['code']>(
  exec: ToolRunContext,
  codes: readonly C[],
  operation: (agent: Agent) => Promise<T>,
): Promise<T | DeclaredError<C> | SubagentSessionError | InternalScheduleError> {
  const agent = exec.agent
  if (agent === undefined) return internalError()
  if (delegationDepthOf(agent) > 0) {
    return { code: 'subagent_session', message: 'A delegated subagent cannot use scheduled tasks.' }
  }
  try {
    return await operation(agent)
  } catch (error: unknown) {
    if (error instanceof ScheduleInputError) {
      const code = codes.find(code => code === error.code)
      if (code !== undefined) return { code, message: error.message }
    }
    return internalError()
  }
}

/**
 * Resolve one model target choice to a delivery destination.
 *
 * A created Session uses the caller's working directory and current composed preset; a preset selection in an
 * empty Session changes that composition without rewriting the Session header.
 * @param agent - Calling root Agent.
 * @param target - Model target choice.
 * @returns Destination request for the Schedule service.
 */
function targetFor(agent: Agent, target: typeof TARGET_CHOICES[number]): ScheduleTargetRequest {
  if (target === 'this_session') return { kind: 'session', sessionId: agent.session.id }
  const cwd = agent.session.header.cwd
  const agentPreset = agent.ctx.get('agentPresets')?.composedPreset(agent.ctx)
  return {
    kind: target,
    create: {
      ...(cwd === undefined ? {} : { cwd }),
      ...(agentPreset === undefined ? {} : { agentPreset }),
    },
  }
}

/** Model-facing creation route fields shared by `schedule_create` and `schedule_edit`. */
interface ModelSelectionArgs {
  readonly provider?: string
  readonly model?: string
  readonly reasoning_effort?: string
}

/**
 * Read the optional creation model route from tool arguments.
 *
 * A route needs provider and model together; an effort is meaningful only for a complete route. A route applies to
 * the Sessions a creating target makes, so an existing-Session destination refuses it.
 * @param args - `provider`, `model`, and `reasoning_effort` arguments.
 * @returns The creation model route, or undefined when the call names no model.
 * @throws ScheduleInputError `invalid_selector` when a value is empty or the route is incomplete.
 */
function modelFor(args: ModelSelectionArgs): ScheduleModelSelection | undefined {
  const { provider, model, reasoning_effort: effort } = args
  if (provider === undefined && model === undefined && effort === undefined) return undefined
  if (provider === undefined || model === undefined) {
    throw new ScheduleInputError('invalid_selector',
      'provider and model must be supplied together; reasoning_effort also requires both.')
  }
  if (provider === '' || model === '' || effort === '') {
    throw new ScheduleInputError('invalid_selector',
      'provider, model, and reasoning_effort must be non-empty when present.')
  }
  return { provider, model, ...(effort === undefined ? {} : { reasoningEffort: effort }) }
}

/**
 * Add an optional model route to the creation values of a destination.
 * @param target - Destination resolved from the model target choice.
 * @param model - Model route selected by the call, if any.
 * @returns The destination, with the route on the creation values of a creating target.
 * @throws ScheduleInputError `invalid_selector` when an existing-Session destination carries a model route.
 */
function withCreationModel(
  target: ScheduleTargetRequest,
  model: ScheduleModelSelection | undefined,
): ScheduleTargetRequest {
  if (model === undefined) return target
  if (target.kind === 'session') {
    throw new ScheduleInputError('invalid_selector',
      'this_session delivers to an existing session, which keeps its own model; provider, model, and reasoning_effort apply only to new_once and new targets.')
  }
  const create = { ...target.create, model }
  return target.kind === 'new_once' ? { kind: 'new_once', create } : { kind: 'new', create }
}

/**
 * Replace only the creation model route of a stored destination.
 * @param target - Stored destination of the edited task.
 * @param model - Replacement model route.
 * @returns Destination request that keeps the stored directory and preset.
 * @throws ScheduleInputError `invalid_selector` when the task delivers to an existing Session.
 */
function retargetModel(target: ScheduleTarget, model: ScheduleModelSelection): ScheduleTargetRequest {
  if (target.kind === 'session') {
    throw new ScheduleInputError('invalid_selector',
      'This task delivers to an existing session, which keeps its own model; supply target new_once or new with provider and model to select a model.')
  }
  const create = { ...target.create, model }
  return target.kind === 'new_once' ? { kind: 'new_once', create } : { kind: 'new', create }
}

/**
 * Register the four Schedule tools and shared guidance in the mounting scope.
 *
 * Each call acts for the Agent that dispatched it, so a mount outside an
 * agent scope still registers the tools but every call without a caller Agent
 * is refused as an internal failure.
 * @param ctx - Context owning the tool and system-prompt registries and the Host Schedule service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['schedule'], registerScheduleTools)
}

/**
 * Register the tools and shared guidance in the scope that resolved Schedule.
 * @param ctx - Scope whose `schedule` service the tools act through.
 */
function registerScheduleTools(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'tool:schedule',
    order: ctx.systemPrompt.getSectionOrder('TOOL_SCHEDULE'),
    text: ({ scope }) => ctx.tools.get('schedule_create', scope) !== undefined
      || ctx.tools.get('schedule_edit', scope) !== undefined
      ? MANAGEMENT_AUTHORIZATION
      : '',
  })

  // Plugin configuration is fixed for the life of the Host service, so the description is read once.
  const targetDescription = targetHelp(ctx.schedule.deliveryLimits().newSessionIntervalSeconds)

  ctx.tools.register(defineTool({
    name: 'schedule_create',
    description: CREATE_DESCRIPTION,
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: TITLE_HELP,
      },
      prompt: { type: 'string', required: true, description: 'Instruction delivered at each occurrence.' },
      rrule: { type: 'string', required: true, description: RRULE_HELP },
      target: { type: 'string', required: true, enum: TARGET_CHOICES, description: targetDescription },
      provider: { type: 'string', description: PROVIDER_HELP },
      model: { type: 'string', description: MODEL_HELP },
      reasoning_effort: { type: 'string', description: REASONING_EFFORT_HELP },
    },
    output: { schema: CREATE_OUTPUT_SCHEMA, render: renderValue },
    execute(args, exec) {
      return runForCaller(exec, CREATE_ERRORS, (agent) => {
        const target = withCreationModel(targetFor(agent, args.target), modelFor(args))
        return ctx.schedule.create({
          title: args.title, prompt: args.prompt, timing: { kind: 'rrule', rrule: args.rrule }, target,
        }, agent.session.id, exec.signal).then(modelTask)
      })
    },
    presentCall: args => present('Create scheduled task', 'other', args.title),
  }))

  ctx.tools.register(defineTool({
    name: 'schedule_list',
    description: LIST_DESCRIPTION,
    parameters: {
      active: {
        type: 'boolean',
        description: 'true for active tasks only; false for paused and ended tasks only; omitted for all tasks.',
      },
      limit: { type: 'integer', description: `Page size from 1 to ${MAX_LIST_LIMIT}; defaults to ${DEFAULT_LIST_LIMIT}.` },
      offset: { type: 'integer', description: 'Number of tasks to skip; defaults to 0.' },
    },
    output: { schema: LIST_OUTPUT_SCHEMA, render: renderValue },
    // Host task reads activate no target Session.
    isConcurrencySafe: () => true,
    execute({ active, limit, offset }, exec) {
      // The open parameter root admits unknown keys; only the declared page fields select the Host-wide list.
      return runForCaller(exec, LIST_ERRORS, () => ctx.schedule.list({
        ...(active === undefined ? {} : { active }),
        ...(limit === undefined ? {} : { limit }),
        ...(offset === undefined ? {} : { offset }),
      }).then(page => ({ ...page, items: page.items.map(modelTask) })))
    },
    presentCall: () => present('List scheduled tasks', 'read'),
  }))

  ctx.tools.register(defineTool({
    name: 'schedule_view',
    description: VIEW_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true, description: 'Task id.' },
    },
    output: { schema: VIEW_OUTPUT_SCHEMA, render: renderValue },
    // Host task reads activate no target Session.
    isConcurrencySafe: () => true,
    execute(args, exec) {
      return runForCaller(exec, CALLER_ERRORS, () => ctx.schedule.view({ id: brandString<ScheduleId>(args.id) })
        .then(result => 'kind' in result ? modelTask(result) : result))
    },
    presentCall: args => present('View scheduled task', 'read', args.id),
  }))

  ctx.tools.register(defineTool({
    name: 'schedule_edit',
    description: EDIT_DESCRIPTION,
    parameters: {
      id: { type: 'string', required: true, description: 'Task id.' },
      action: {
        type: 'string',
        required: true,
        enum: ['update', 'delete'],
        description: 'update applies the provided fields, at least one; delete removes the task.',
      },
      title: { type: 'string', description: TITLE_HELP },
      prompt: { type: 'string', description: 'New instruction delivered at each occurrence.' },
      rrule: { type: 'string', description: 'New recurrence in the schedule_create rrule format.' },
      target: { type: 'string', enum: TARGET_CHOICES, description: 'Omit to retain the destination and its creation settings. '
        + 'Providing target replaces them; new_once reserves a different Session. New targets capture this Session\'s '
        + 'working directory and preset, and any model selected by provider, model, and reasoning_effort. '
        + 'Choices are the same as schedule_create.' },
      provider: { type: 'string', description: PROVIDER_HELP },
      model: { type: 'string', description: MODEL_HELP },
      reasoning_effort: { type: 'string', description: REASONING_EFFORT_HELP },
      active: { type: 'boolean', description: 'false pauses the task; true resumes only if its timing has a future occurrence. '
        + 'Otherwise provide a new rrule.' },
      expectedUpdatedAt: {
        type: 'string',
        description: 'updatedAt from the latest result that returned this task; '
          + 'if the task changed after that result, the result is schedule_conflict and nothing changes.',
      },
    },
    output: { schema: EDIT_OUTPUT_SCHEMA, render: renderValue },
    execute(args, exec) {
      return runForCaller(exec, EDIT_ERRORS, async (agent) => {
        const id = brandString<ScheduleId>(args.id)
        const expected = args.expectedUpdatedAt === undefined ? {} : { expectedUpdatedAt: args.expectedUpdatedAt }
        let request: ScheduleEditRequest
        if (args.action === 'delete') {
          if (PATCH_FIELDS.some(field => args[field] !== undefined)) {
            throw new ScheduleInputError('invalid_selector', 'delete accepts only id, action, and expectedUpdatedAt.')
          }
          request = { id, action: 'delete', ...expected }
        } else {
          const model = modelFor(args)
          let target: ScheduleTargetRequest | undefined
          if (args.target !== undefined) {
            target = withCreationModel(targetFor(agent, args.target), model)
          } else if (model !== undefined) {
            const current = await ctx.schedule.view({ id })
            // A miss keeps the edit result the same as an edit of a missing task.
            if (!('kind' in current)) return current
            target = retargetModel(current.target, model)
          }
          const patch = {
            ...(args.title === undefined ? {} : { title: args.title }),
            ...(args.prompt === undefined ? {} : { prompt: args.prompt }),
            ...(args.rrule === undefined ? {} : { timing: { kind: 'rrule' as const, rrule: args.rrule } }),
            ...(target === undefined ? {} : { target }),
            ...(args.active === undefined ? {} : { active: args.active }),
          }
          if (Object.keys(patch).length === 0) {
            throw new ScheduleInputError('invalid_selector',
              'update requires at least one of title, prompt, rrule, target, active, provider, model, or reasoning_effort.')
          }
          request = { id, action: 'update', patch, ...expected }
        }
        return ctx.schedule.edit(request, agent.session.id, exec.signal)
          .then(result => 'kind' in result ? modelTask(result) : result)
      })
    },
    presentCall: args => present(args.action === 'delete' ? 'Delete scheduled task' : 'Edit scheduled task', 'other', args.id),
  }))
}
