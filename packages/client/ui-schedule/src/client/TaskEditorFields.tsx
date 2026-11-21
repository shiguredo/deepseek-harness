/** Fields shared by manual creation and editing inside the existing Rules view. */
import type { ReactNode } from 'react'
import { useId, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelCatalog, ModelReasoning } from '@deepseek-ai/dsh-api-remotes/client'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  ScheduleCatalogEntry, ScheduleModelSelection, SchedulePatch, ScheduleTargetRequest,
} from '@deepseek-ai/dsh-schedule/client'
import { Cron, RRule } from '@deepseek-ai/dsh-util-time'
import clsx from 'clsx'
import { DEFAULT_WORKSPACE_DIRECTORY, workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace'
import { Button, IconClockOutlineRegular, Input, PathLabel } from '@deepseek-ai/dsh-client-ui-primitives'
import { ClockPicker } from './ClockPicker.tsx'
import { DatePicker } from './DatePicker.tsx'
import { defaultTiming, rruleFromDraft, timingFromDraft, timingFromRecord } from './editor-timing.ts'
import type { FrequencyPreset, TimingDraft } from './editor-timing.ts'
import { findModelRoute, modelRouteId, modelRoutes } from './model-catalog.ts'
import type { ModelCatalogSnapshot } from './model-catalog.ts'
import { RuleSelectRow, RuleZoneRow } from './RuleSelectRow.tsx'
import { formatScheduleFrequency, zoneLabel } from './schedule-format.ts'
import type { FrequencyZone } from './schedule-format.ts'
import type { TaskMenuEntry } from './TaskMenu.tsx'
import { RuleStepper, RuleWeekdayRow } from './TaskRuleControls.tsx'
import { IconCalendarOutlineRegular } from './CalendarIcon.tsx'
import type { TaskManagerKey } from './task-manager-locales.ts'
import css from './TaskManagerPage.module.css'

/** Menu row that stands for an unspecified creation model, so the Host default applies. */
const HOST_DEFAULT_MODEL = 'host-default'

/** Menu row that stands for an unspecified reasoning effort, so the model default applies. */
const MODEL_DEFAULT_EFFORT = 'effort-default'

/** Local form values; only Save writes a task. */
export interface TaskEditorDraft extends TimingDraft {
  readonly title: string
  readonly prompt: string
  readonly target: 'session' | 'new_once' | 'new'
  readonly sessionId: string
  readonly cwd: string
  /** Creation model route of a new destination; null follows the Host default. */
  readonly model: ScheduleModelSelection | null
}

/** Registered Workspaces offered as the directory of a created Session. */
interface ProjectChoices {
  readonly items: readonly { readonly value: string; readonly label: string }[]
  /** Directory a new destination starts with: the default Workspace, else the first listed one, else empty. */
  readonly defaultCwd: string
}

/** Label Workspaces as the Workspace list does and select the directory a new destination starts with. */
export function projectChoices(workspaces: WorkspaceSnapshot['items'], defaultName: string): ProjectChoices {
  return {
    items: workspaces.map(workspace => ({ value: workspace.path, label: workspaceDisplayTitle(workspace.title, defaultName) })),
    defaultCwd: (workspaces.find(workspace => workspace.title === DEFAULT_WORKSPACE_DIRECTORY) ?? workspaces[0])?.path ?? '',
  }
}

/** Initialize a new task without creating or activating a Session. */
export function newTaskDraft(): TaskEditorDraft {
  return { ...defaultTiming(), title: '', prompt: '', target: 'new_once', sessionId: '', cwd: '', model: null }
}

/** Seed an edit without normalizing unsupported stored rules. */
export function taskDraft(task: ScheduleCatalogEntry): TaskEditorDraft {
  return {
    ...timingFromRecord(task), title: task.title, prompt: task.prompt,
    target: task.target.kind, sessionId: task.target.kind === 'session' ? task.target.sessionId : '',
    cwd: task.target.kind === 'session' ? '' : task.target.create.cwd ?? '',
    model: task.target.kind === 'session' ? null : task.target.create.model ?? null,
  }
}

/**
 * Validate the form while retaining untouched stored timing.
 * @param draft - Current form values.
 * @param changes - Existing task patch; omitted validates a new timing as well.
 * @returns First correction key, `incomplete` for missing required fields, or undefined when valid.
 */
export function taskDraftIssue(draft: TaskEditorDraft, changes?: SchedulePatch): TaskManagerKey | 'incomplete' | undefined {
  if (draft.title.trim() === '' || draft.prompt.trim() === '' || draft.target === 'session' && draft.sessionId === '') return 'incomplete'
  if (draft.title.trim().length > 120) return 'rule.invalidTitle'
  if (draft.frequency !== 'once' && draft.frequency !== 'advanced'
    && (!/^[1-9]\d*$/.test(draft.interval) || !Number.isSafeInteger(Number(draft.interval)))) return 'rule.invalidInterval'
  if (draft.frequency === 'weekly' && draft.weekdays.length === 0) return 'rule.requiredWeekday'
  if (draft.frequency === 'monthly' && (!Number.isInteger(draft.monthDay) || draft.monthDay < 1 || draft.monthDay > 31)) return 'rule.invalidMonthDay'
  if (draft.frequency === 'daily' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.dailyTime)) return 'rule.invalidTime'
  // An untouched stored rule remains authoritative for a content-only edit.
  if (changes !== undefined && changes.timing === undefined) return undefined
  const timing = timingFromDraft(draft, true)
  const parsed = timing.kind === 'cron' ? Cron.parse(timing.cron.expression, timing.cron.time_zone)
    : timing.kind === 'rrule' ? RRule.parse(timing.rrule, { rejectIneffectiveSetPositions: true }) : undefined
  if (parsed?.kind !== 'rejected') return undefined
  if (parsed.reason === 'time_zone') return 'rule.invalidZone'
  if (parsed.reason === 'density') return 'rule.tooComplex'
  return draft.frequency === 'advanced' ? 'rule.invalid' : 'rule.invalidTime'
}

/** Only meaningful field changes enter the CAS edit; untouched timing is never rewritten. */
export function taskDraftPatch(draft: TaskEditorDraft, original: ScheduleCatalogEntry, intervalFromNow = false): SchedulePatch {
  const seeded = taskDraft(original)
  const timingChanged = JSON.stringify(timingFromDraft(draft)) !== JSON.stringify(timingFromDraft(seeded))
  const targetChanged = draft.target !== seeded.target || draft.sessionId !== seeded.sessionId || draft.cwd !== seeded.cwd
    || JSON.stringify(draft.model) !== JSON.stringify(seeded.model)
  return {
    ...(draft.title.trim() === seeded.title.trim() ? {} : { title: draft.title.trim() }),
    ...(draft.prompt.trim() === seeded.prompt.trim() ? {} : { prompt: draft.prompt.trim() }),
    ...(timingChanged ? { timing: timingFromDraft(draft, intervalFromNow) } : {}),
    ...(targetChanged ? { target: draftTarget(draft, original) } : {}),
  }
}

/** Reapply changed field groups only after the user chooses to review a newer revision. */
export function reapplyTaskDraft(draft: TaskEditorDraft, latest: ScheduleCatalogEntry, changes: SchedulePatch): TaskEditorDraft {
  const { title, prompt, target, sessionId, cwd, model, ...timing } = draft
  const { title: latestTitle, prompt: latestPrompt, target: latestTarget,
    sessionId: latestSessionId, cwd: latestCwd, model: latestModel, ...latestTiming } = taskDraft(latest)
  return {
    ...(changes.timing === undefined ? latestTiming : timing),
    title: changes.title === undefined ? latestTitle : title,
    prompt: changes.prompt === undefined ? latestPrompt : prompt,
    ...(changes.target === undefined
      ? { target: latestTarget, sessionId: latestSessionId, cwd: latestCwd, model: latestModel }
      : { target, sessionId, cwd, model }),
  }
}

/** Resolve the explicit destination, preserving an existing preset when the project is unchanged. */
export function draftTarget(draft: TaskEditorDraft, original?: ScheduleCatalogEntry): ScheduleTargetRequest {
  if (draft.target === 'session') return { kind: 'session', sessionId: draft.sessionId as SessionId }
  const previous = original?.target.kind === 'session' ? undefined : original?.target.create
  const create = {
    ...(draft.cwd === '' ? {} : { cwd: draft.cwd }),
    ...((previous?.cwd ?? '') === draft.cwd && previous?.agentPreset !== undefined ? { agentPreset: previous.agentPreset } : {}),
    // A null model removes the stored override instead of writing the Host default as an explicit route.
    ...(draft.model === null ? {} : { model: draft.model }),
  }
  return { kind: draft.target, create }
}

/**
 * Render one model row with its provider leading the name, so a model id that
 * several providers serve stays unambiguous.
 * @param provider - provider display name, or its id when the catalog omits the route.
 * @param model - model display name, or its id when the catalog omits the route.
 * @returns the caption-toned provider, a separator, and the model name.
 */
function providerRouteLabel(provider: string, model: string): ReactNode {
  return <><span className={css.modelMenuProvider}>{provider}</span>{' · '}{model}</>
}

/**
 * Rows of the model menu: the Host default, a saved route the catalog omits,
 * then every advertised model under its provider.
 * @param catalog - successfully read catalog, if any.
 * @param saved - saved route that is not advertised, or null when the selection is unset or found.
 * @param labels - localized rows for the Host default and the omitted saved route.
 * @returns the menu rows in display order.
 */
function modelMenuItems(
  catalog: ModelCatalog | undefined,
  saved: ScheduleModelSelection | null,
  labels: { readonly hostDefault: string; readonly saved: string },
): TaskMenuEntry[] {
  const items: TaskMenuEntry[] = [{ id: HOST_DEFAULT_MODEL, label: labels.hostDefault }]
  if (saved !== null) {
    items.push({ type: 'label', id: 'saved-model', text: labels.saved })
    items.push({ id: modelRouteId(saved), label: providerRouteLabel(saved.provider, saved.model) })
  }
  for (const provider of catalog?.groups ?? []) {
    for (const model of provider.models) {
      items.push({ id: modelRouteId({ provider: provider.id, model: model.id }), label: providerRouteLabel(provider.name, model.name) })
    }
  }
  return items
}

/**
 * Rows of the effort menu: the unspecified choice when the model advertises no
 * default, one stored level the catalog omits, then every advertised level.
 * @param reasoning - advertised reasoning metadata of the selected model.
 * @param stored - effort saved with the current route, if any.
 * @param unsetLabel - localized row for the unspecified effort.
 * @returns the menu rows in display order.
 */
function effortMenuItems(reasoning: ModelReasoning, stored: string | undefined, unsetLabel: string): TaskMenuEntry[] {
  const items: TaskMenuEntry[] = reasoning.defaultEffort === undefined
    ? [{ id: MODEL_DEFAULT_EFFORT, label: unsetLabel }] : []
  if (stored !== undefined && !reasoning.efforts.some(level => level.id === stored)) {
    items.push({ id: `effort:${stored}`, label: stored })
  }
  for (const level of reasoning.efforts) items.push({ id: `effort:${level.id}`, label: level.name })
  return items
}

/**
 * Reasoning effort row of one creation model route.
 * @param props.model - selected creation route.
 * @param props.reasoning - advertised effort levels of that route.
 * @param props.disabled - whether the row rejects input.
 * @param props.onChange - replaces the selected route with the chosen effort.
 * @param props.t - task-manager translations.
 * @returns the labelled effort menu row.
 */
function TaskEffortRow({ model, reasoning, disabled, onChange, t }: {
  readonly model: ScheduleModelSelection
  readonly reasoning: ModelReasoning
  readonly disabled: boolean
  readonly onChange: (model: ScheduleModelSelection) => void
  readonly t: PropsLocale<'schedule.manager'>['t']
}): ReactNode {
  const effectiveEffort = model.reasoningEffort ?? reasoning.defaultEffort
  const label = effectiveEffort === undefined ? t('host.effortDefault')
    : reasoning.efforts.find(level => level.id === effectiveEffort)?.name ?? effectiveEffort
  return <RuleSelectRow label={t('host.effort')}
    value={effectiveEffort === undefined ? MODEL_DEFAULT_EFFORT : `effort:${effectiveEffort}`}
    current={label} disabled={disabled}
    items={effortMenuItems(reasoning, model.reasoningEffort, t('host.effortDefault'))}
    onChange={(id) => {
      if (id === MODEL_DEFAULT_EFFORT) {
        const { reasoningEffort: _stored, ...route } = model
        onChange(route)
        return
      }
      onChange({ ...model, reasoningEffort: id.slice('effort:'.length) })
    }} />
}

/**
 * Render manual creation and inline edits with the existing task rule controls.
 * @param props.disabled - whether the fields reject input.
 * @param props.held - whether a disabled state keeps the enabled look because it lasts only one brief request.
 * @param props.modelCatalog - shared Host model catalog the creation target selects a route from.
 * @param props.onRetryModelCatalog - reread the model catalog after a failed read.
 */
export function TaskEditorFields({ draft, onChange, projects, disabled, held, original, modelCatalog, onRetryModelCatalog, t }: {
  readonly draft: TaskEditorDraft
  readonly onChange: (draft: TaskEditorDraft) => void
  readonly projects: ProjectChoices
  readonly disabled: boolean
  readonly held: boolean
  readonly original?: ScheduleCatalogEntry | undefined
  readonly modelCatalog: ModelCatalogSnapshot
  readonly onRetryModelCatalog: () => Promise<void>
  readonly t: PropsLocale<'schedule.manager'>['t']
}): ReactNode {
  const [dateOpen, setDateOpen] = useState(false)
  const [clockOpen, setClockOpen] = useState(false)
  const dateAnchor = useRef<HTMLButtonElement>(null)
  const clockAnchor = useRef<HTMLButtonElement>(null)
  const id = useId()
  const dateAnchorName = `--dsh-schedule-date-${id.replaceAll(':', '')}`
  const clockAnchorName = `--dsh-schedule-clock-${id.replaceAll(':', '')}`
  const rowId = (name: string): string => `${id}-${name}`
  const change = (patch: Partial<TaskEditorDraft>): void => { onChange({ ...draft, ...patch }) }
  const clock = draft.frequency === 'daily' ? `${draft.dailyTime}:00` : draft.start.slice(11)
  const frequencyZone: FrequencyZone = { system: Intl.DateTimeFormat().resolvedOptions().timeZone, label: zone => zoneLabel(zone, t) }
  const targetLabel = (target: TaskEditorDraft['target']): string =>
    t(target === 'session' ? 'host.currentConversation' : target === 'new_once' ? 'host.targetNewOnce' : 'host.targetNew')
  const currentSessionId = original?.target.kind === 'session' ? original.target.sessionId : ''
  const weekdays = draft.frequency === 'weekly' && draft.weekdays.length === 5 && [1, 2, 3, 4, 5].every(day => draft.weekdays.includes(day))
  const frequencyItems = [
    { id: 'weekly', label: t('rule.weekly') }, { id: 'weekdays', label: t('rule.weekdays') },
    { id: 'daily', label: t('rule.daily') }, { id: 'hourly', label: t('rule.everyHours') },
    { id: 'minutely', label: t('rule.everyMinutes') }, { id: 'monthly', label: t('host.frequency.monthly') },
    { id: 'once', label: t('rule.once') }, { id: 'advanced', label: t('host.frequency.advanced') },
  ]
  const frequencyValue = weekdays ? 'weekdays' : draft.frequency
  // The directory line tells which folder a Workspace title such as Default workspace stands for.
  const workspaceItems = projects.items.map(choice => ({
    id: choice.value, label: <span className={css.workspaceMenuItem}><span>{choice.label}</span>
      <PathLabel path={choice.value} className={css.workspaceMenuPath} /></span>,
  }))
  const routes = modelRoutes(modelCatalog.catalog)
  const routeItems = routes.map((route) => {
    const selection: ScheduleModelSelection = {
      provider: route.provider.id,
      model: route.model.id,
      ...(route.model.reasoning?.defaultEffort === undefined ? {} : { reasoningEffort: route.model.reasoning.defaultEffort }),
    }
    return { id: modelRouteId(selection), selection }
  })
  const currentRoute = draft.model === null ? undefined : findModelRoute(routes, draft.model)
  // A saved route the catalog omits stays selected and listed rather than resetting the form.
  const savedModel = draft.model !== null && currentRoute === undefined ? draft.model : null
  const modelItems = modelMenuItems(modelCatalog.catalog, savedModel,
    { hostDefault: t('host.modelDefault'), saved: t('host.modelSaved') })
  const loadingModels = modelCatalog.status === 'loading'
  const modelDisabled = disabled || loadingModels || (modelCatalog.status === 'error' && modelCatalog.catalog === undefined)
  const currentModelLabel = loadingModels ? t('host.modelsLoading')
    : currentRoute?.model.name ?? (draft.model === null ? t('host.modelDefault') : draft.model.model)
  // The model value leads with its provider; a catalog-omitted saved route keeps its stored id.
  const currentModelProvider = draft.model === null || loadingModels ? undefined
    : currentRoute?.provider.name ?? draft.model.provider
  const reasoning = currentRoute?.model.reasoning
  // The effort row needs the advertised levels of the selected model, so it waits for the catalog.
  const effortRow: { readonly model: ScheduleModelSelection; readonly reasoning: ModelReasoning } | undefined =
    draft.model !== null && reasoning !== undefined && reasoning.efforts.length > 0 && !loadingModels
      ? { model: draft.model, reasoning } : undefined
  const chooseModel = (id: string): void => {
    const chosen = routeItems.find(item => item.id === id)
    if (chosen !== undefined) change({ model: chosen.selection })
    else if (id === HOST_DEFAULT_MODEL) change({ model: null })
    // Any other id is the saved route the catalog omits, which is already selected.
  }
  return <fieldset disabled={disabled} className={held ? `${css.taskEditor} ${css.editorHeld}` : css.taskEditor} onKeyDownCapture={(event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !dateOpen && !clockOpen) return
    event.preventDefault(); event.stopPropagation()
    if (dateOpen) { setDateOpen(false); dateAnchor.current?.focus() }
    else { setClockOpen(false); clockAnchor.current?.focus() }
  }}>
    <label className={css.editorField}>{t('detail.name')}<Input value={draft.title} maxLength={120} aria-required placeholder={t('detail.namePlaceholder')}
      onChange={(event) => { change({ title: event.target.value }) }} /></label>
    <label className={css.editorField}>{t('detail.instruction')}<textarea className={css.instruction} aria-required placeholder={t('detail.instructionPlaceholder')}
      value={draft.prompt} onChange={(event) => { change({ prompt: event.target.value }) }} /></label>
    <div className={css.destinationGroup}>
      <div className={css.ruleRows}>
        <RuleSelectRow label={t('host.target')} value={draft.target} current={targetLabel(draft.target)} disabled={disabled}
          listClassName={css.targetMenu} items={[
            ...(currentSessionId === '' ? [] : [{ id: 'session', label: targetLabel('session') }]),
            ...(['new_once', 'new'] as const).map(value => ({
              id: value, label: <span className={css.targetMenuItem}><span>{targetLabel(value)}</span>
                <span className={css.targetMenuDescription}>{t(value === 'new_once' ? 'host.targetNewOnceHelp' : 'host.targetNewHelp')}</span></span>,
            })),
          ]}
          onChange={(value) => { change({ target: value as TaskEditorDraft['target'],
            sessionId: value === 'session' ? currentSessionId : draft.sessionId,
            cwd: value === 'session' ? '' : draft.target === 'session' ? projects.defaultCwd : draft.cwd }) }} />
        {draft.target !== 'session' && <>
          <RuleSelectRow label={t('host.project')} value={draft.cwd} disabled={disabled}
            current={projects.items.find(choice => choice.value === draft.cwd)?.label ?? (draft.cwd || t('host.ungrouped'))}
            listClassName={css.workspaceMenu} items={workspaceItems.length === 0 ? [{ id: '', label: t('host.ungrouped'), disabled: true }]
              : workspaceItems} onChange={(cwd) => { change({ cwd }) }} />
          <RuleSelectRow label={t('host.model')} value={draft.model === null ? HOST_DEFAULT_MODEL : modelRouteId(draft.model)}
            current={currentModelLabel} currentLead={currentModelProvider} disabled={modelDisabled} items={modelItems}
            listClassName={css.modelMenu} onChange={chooseModel} />
          {effortRow !== undefined && <TaskEffortRow {...effortRow} disabled={disabled}
            onChange={(model) => { change({ model }) }} t={t} />}
        </>}
      </div>
      {draft.target !== 'session' && modelCatalog.status === 'error' && <div className={clsx(css.notice, css.modelNotice)}>
        <p role="alert">{t('host.modelsError')}</p>
        <Button size="sm" onClick={() => { void onRetryModelCatalog() }}>{t('list.retry')}</Button>
      </div>}
    </div>
    <section className={css.editorField} aria-label={t('rule.title')}><h3>{t('rule.title')}</h3><div className={css.ruleRows}>
      <RuleSelectRow label={t('rule.repeat')} value={frequencyValue} disabled={disabled} items={frequencyItems}
        current={(frequencyItems.find(item => item.id === frequencyValue) as { label: string }).label} onChange={(value) => {
          const frequency = value === 'weekdays' ? 'weekly' : value as FrequencyPreset
          change({ frequency, ...(value === 'weekdays' ? { weekdays: [1, 2, 3, 4, 5] } : {}),
            ...(frequency === 'advanced' ? { rrule: rruleFromDraft(draft, original === undefined) } : {}) })
        }} />
      {draft.frequency !== 'once' && draft.frequency !== 'advanced' && <div className={css.ruleRow}>
        <label className={css.ruleLabel} htmlFor={rowId('interval')}>{t('host.interval')}</label>
        <RuleStepper id={rowId('interval')} min={1} max={Number.MAX_SAFE_INTEGER} value={Number(draft.interval)} disabled={disabled}
          increaseLabel={t('timing.intervalIncrease')} decreaseLabel={t('timing.intervalDecrease')}
          onChange={(value) => { change({ interval: String(value) }) }} />
      </div>}
      {draft.frequency === 'weekly' && <RuleWeekdayRow weekdays={draft.weekdays} disabled={disabled} t={t} rowId={rowId}
        onToggle={(day) => { change({ weekdays: draft.weekdays.includes(day)
          ? draft.weekdays.filter(value => value !== day) : [...draft.weekdays, day].sort() }) }} />}
      {draft.frequency === 'monthly' && <div className={css.ruleRow}>
        <label className={css.ruleLabel} htmlFor={rowId('monthDay')}>{t('host.monthDay')}</label>
        <RuleStepper id={rowId('monthDay')} min={1} max={31} value={draft.monthDay} disabled={disabled}
          increaseLabel={t('timing.intervalIncrease')} decreaseLabel={t('timing.intervalDecrease')}
          onChange={(value) => { change({ monthDay: value }) }} />
      </div>}
      {draft.frequency === 'once' && <div className={css.ruleRow}>
        <label className={css.ruleLabel} htmlFor={rowId('date')}>{t('timing.date')}</label>
        <button ref={dateAnchor} style={{ anchorName: dateAnchorName }} id={rowId('date')} type="button" disabled={disabled}
          className={clsx(css.ruleInput, css.ruleControl, css.pickerTrigger)} aria-label={t('timing.date')}
          aria-haspopup="dialog" aria-expanded={dateOpen} onClick={() => { setDateOpen(true) }}>
          <span>{draft.start.slice(0, 10).replaceAll('-', '/')}</span><IconCalendarOutlineRegular className={css.pickerIcon} />
        </button>
        <DatePicker open={dateOpen && !disabled} anchorRef={dateAnchor} anchorName={dateAnchorName} value={draft.start.slice(0, 10)}
          onPick={(date) => { change({ start: `${date}T${clock}` }); setDateOpen(false) }}
          onClose={() => { setDateOpen(false) }} t={t} />
      </div>}
      {draft.frequency !== 'advanced' && draft.frequency !== 'minutely' && draft.frequency !== 'hourly' && <div className={css.ruleRow}>
        <label className={css.ruleLabel} htmlFor={rowId('time')}>{t('timing.time')}</label>
        <button ref={clockAnchor} style={{ anchorName: clockAnchorName }} id={rowId('time')} type="button" disabled={disabled}
          className={clsx(css.ruleInput, css.ruleControl, css.pickerTrigger)} aria-label={t('timing.time')}
          aria-haspopup="dialog" aria-expanded={clockOpen} onClick={() => { setClockOpen(true) }}>
          <span>{clock}</span><IconClockOutlineRegular className={css.pickerIcon} />
        </button>
        <ClockPicker open={clockOpen && !disabled} anchorRef={clockAnchor} anchorName={clockAnchorName} value={clock} seconds={draft.frequency !== 'daily'}
          onPick={(time) => { change(draft.frequency === 'daily' ? { dailyTime: time.slice(0, 5) }
            : { start: `${draft.start.slice(0, 10)}T${time}` }) }} onClose={() => { setClockOpen(false) }} t={t} />
      </div>}
      {(draft.frequency !== 'advanced' || draft.rrule.trim() !== '' && !draft.rrule.trimStart().startsWith('DTSTART')) && <RuleZoneRow value={draft.timeZone} disabled={disabled} t={t}
        onChange={(timeZone) => { change({ timeZone }) }} />}
    </div></section>
    {draft.frequency === 'advanced' && <div className={css.editorField}>
      {original !== undefined && original.kind !== 'rrule' && original.kind !== 'cron' && draft.rrule === ''
        && <p>{formatScheduleFrequency(original, t, frequencyZone)}</p>}
      <label className={css.editorField}>{t('host.customRule')}<textarea className={css.instruction}
        value={draft.rrule} onChange={(event) => { change({ rrule: event.target.value }) }} /></label>
    </div>}

  </fieldset>
}
