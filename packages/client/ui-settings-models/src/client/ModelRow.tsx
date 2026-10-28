/** Shared model fields and actions for both adapter catalog editors. */

import { useState, type DragEvent, type ReactNode } from 'react'
import {
  IconChevronDownOutlineRegular, IconChevronRightOutlineRegular, IconDragHandleOutlineRegular,
  IconTrashOutlineRegular, Tooltip, useRowDragPreview,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeepSeekModelDraft } from './DeepSeekModelsEditor.tsx'
import type { RoutingProviderOption } from './store.ts'
import type { ModelsKey } from './locales.ts'
import { ModelInputTypes } from './ModelInputTypes.tsx'
import { ModelReasoningEfforts } from './ModelReasoningEfforts.tsx'
import type { ModelRowOrder } from './useModelRows.ts'
import styles from './ModelsSection.module.css'

/** A capacity's editable text and adapter-specific inherited hint. */
interface CapacityInput {
  value: string
  placeholder: string
  onChange: (value: string) => void
  onBlur?: () => void
}

export type { RoutingProviderOption } from './store.ts'

/**
 * The hours the page names when it states the window a model is routed in.
 * Display copy only: the period itself is the model's published price policy
 * and ships with the catalog data, so nothing here is written to settings.
 */
export const PEAK_WINDOW = {
  utc: '12:00–18:00 UTC',
  jst: '21:00–03:00 JST',
} as const

/** The editable peak route of one model row. */
export interface RoutingDraft {
  /** Destination provider route, or empty for no routing. */
  provider: string
  /**
   * Destination model id, or empty to send the routed model's own id to the
   * destination provider.
   */
  model: string
  /**
   * Credential reference the stored destination carries. The control neither
   * shows nor edits it: it rides along so rewriting the same destination keeps
   * it, and a destination this draft changes starts without it, because the
   * reference names a credential of the route that was there.
   */
  apiKeyEnv?: string
}

/**
 * Read one row's peak destination as the form edits it.
 * @param model - the drafted model entry.
 * @returns the editable route; an absent or malformed declaration reads as none.
 */
export function routingDraftOf(model: DeepSeekModelDraft): RoutingDraft {
  const candidates = model['peak']
  const candidate = Array.isArray(candidates) && candidates.length > 0
    ? candidates[0] as Record<string, unknown>
    : undefined
  const provider = candidate?.['provider']
  const destination = candidate?.['model']
  const apiKeyEnv = candidate?.['apiKeyEnv']
  return {
    provider: typeof provider === 'string' ? provider : '',
    model: typeof destination === 'string' ? destination : '',
    ...typeof apiKeyEnv === 'string' && apiKeyEnv !== '' ? { apiKeyEnv } : {},
  }
}

/** Adapter-owned data and actions for one model row. */
interface ModelRowProps {
  model: DeepSeekModelDraft
  rowKey: number
  position: number
  order: ModelRowOrder
  inputField: 'inputModalities' | 'input'
  inputFallback?: readonly string[] | undefined
  inputLoading?: boolean
  /** Levels the row's `reasoningEfforts` may declare; absent or empty shows no reasoning control. */
  reasoningLevels?: readonly string[] | undefined
  expanded: boolean
  disabled: boolean
  t: (key: ModelsKey) => string
  contextWindow: CapacityInput
  maxTokens: CapacityInput
  onFieldChange: (field: 'id' | 'name', value: string | undefined) => void
  onIdBlur?: (value: string) => void
  onChange: (model: DeepSeekModelDraft) => void
  onToggle: () => void
  onRemove: () => void
  routingProviders?: readonly RoutingProviderOption[] | undefined
  /** Apply one peak route, or `undefined` to clear it. */
  onRoutingChange?: ((next: RoutingDraft | undefined) => void) | undefined
}

/**
 * State the fixed window in both zones the operator reads.
 * @param t - page copy reader.
 * @returns the interval and the days it applies to.
 */
function windowValue(t: (key: ModelsKey) => string): string {
  return `${PEAK_WINDOW.utc} / ${PEAK_WINDOW.jst} · ${t('routingWeekdays')}`
}


function rowHalf(event: DragEvent<HTMLElement>): 'before' | 'after' {
  const rect = event.currentTarget.getBoundingClientRect()
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/**
 * Render model fields with the display name in the expanded area of narrow rows.
 * @param props - drafted fields and their owning editor's actions.
 * @returns one expandable model entry.
 */
export function ModelRow(props: ModelRowProps): ReactNode {
  const { model, position, t, disabled } = props
  const preview = useRowDragPreview(styles['modelDragPreview'] as string)
  const routing = props.onRoutingChange === undefined ? undefined : routingDraftOf(model)
  // A destination is not a window until it names a model, so the provider can
  // be chosen while the stored profile still says nothing. Holding that half
  // choice here keeps the model control usable without writing a window that
  // would silently route the routed model's own id.
  const [stagedProvider, setStagedProvider] = useState('')
  const destination: RoutingDraft | undefined = routing === undefined
    ? undefined
    : { ...routing, provider: routing.provider === '' ? stagedProvider : routing.provider }
  // A stored destination the catalog no longer lists stays selectable, so the
  // row shows what the profile actually says instead of blanking the select.
  const routingOptions = props.routingProviders === undefined || destination === undefined
    ? []
    : destination.provider !== '' && !props.routingProviders.some(option => option.id === destination.provider)
      ? [{ id: destination.provider, name: destination.provider, models: [] }, ...props.routingProviders]
      : props.routingProviders
  const editRouting = (next: Partial<RoutingDraft>): void => {
    /* v8 ignore next -- the control is only rendered when the draft exists */
    if (destination === undefined) return
    const destinationChanged = next.provider !== undefined && next.provider !== destination.provider
    // A model survives a provider switch only while the new provider serves it:
    // the day/night pair this control exists for often shares one id, and a
    // model the new provider does not offer belongs to the provider that is gone.
    const nextModels = routingOptions.find(option => option.id === next.provider)?.models ?? []
    const keepsModel = next.provider === undefined
      || (next.model === undefined && nextModels.includes(destination.model))
    const merged: RoutingDraft = {
      provider: next.provider ?? destination.provider,
      model: keepsModel ? next.model ?? destination.model : '',
      ...destination.apiKeyEnv === undefined || destinationChanged ? {} : { apiKeyEnv: destination.apiKeyEnv },
    }
    setStagedProvider(merged.provider)
    // A window serves a chosen destination, so an incomplete one is not a
    // window at all: a provider without a model would silently route the
    // routed model's own id, which is the choice this control does not offer.
    props.onRoutingChange?.(merged.provider === '' || merged.model === '' ? undefined : merged)
  }
  const destinationChosen = destination !== undefined && destination.provider !== '' && destination.model !== ''
  // The destination's own catalog, which a stored value survives even when the
  // deployment stopped listing it.
  const routingModels = destination === undefined
    ? []
    : routingOptions.find(option => option.id === destination.provider)?.models ?? []
  const routingModelOptions = destination !== undefined && destination.model !== '' && !routingModels.includes(destination.model)
    ? [destination.model, ...routingModels]
    : routingModels
  const modelField = (field: 'id' | 'name') => (
    <label className={`${styles['modelField']} ${field === 'name' ? styles['modelName'] : ''}`}>
      {field === 'name'
        ? <span className={`${styles['modelFieldLabel']} ${styles['modelNameLabel']}`}>{t('modelName')}</span>
        : null}
      <input
        className={styles['input']}
        type="text"
        value={typeof model[field] === 'string' ? model[field] : ''}
        placeholder={t(field === 'id' ? 'modelId' : 'modelName')}
        aria-label={`${t(field === 'id' ? 'modelId' : 'modelName')} ${String(position)}`}
        disabled={disabled}
        onFocus={field === 'name' && !props.expanded ? props.onToggle : undefined}
        onChange={(event) => {
          const value = event.target.value
          props.onFieldChange(field, field === 'name' && value === '' ? undefined : value)
        }}
        onBlur={field === 'id' ? event => props.onIdBlur?.(event.target.value) : undefined}
      />
    </label>
  )
  return (
    <div
      className={styles['modelEntry']}
      data-row-key={props.rowKey}
      data-dragging={props.order.dragging || undefined}
      data-drop-target={props.order.dragging ? undefined : props.order.target}
      onDragOver={(event) => {
        if (!props.order.canDrop) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        props.order.onOver(rowHalf(event))
      }}
      onDragLeave={(event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
        props.order.onLeave()
      }}
      onDrop={(event) => {
        if (!props.order.canDrop) return
        event.preventDefault()
        props.order.onDrop(rowHalf(event))
      }}
    >
      <div className={styles['modelRow']} data-expanded={props.expanded || undefined}>
        <Tooltip label={t('reorderModelHelp')} portal>
          <button
            type="button"
            className={`${styles['iconButton']} ${styles['modelDragHandle']}`}
            aria-label={`${t('reorderModel')} ${String(position)}`}
            aria-keyshortcuts="ArrowUp ArrowDown"
            aria-description={t('reorderModelHelp')}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('application/x-dsh-model-order', String(position))
              props.order.onStart()
              preview.start(event, event.currentTarget.closest('[data-row-key]') as HTMLElement)
            }}
            onDragEnd={() => { if (preview.clear()) props.order.onEnd() }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
              event.preventDefault()
              event.stopPropagation()
              props.order.onMove(event.key === 'ArrowUp' ? -1 : 1)
            }}
          >
            <IconDragHandleOutlineRegular size={14} />
          </button>
        </Tooltip>
        {modelField('id')}
        <button
          type="button"
          className={styles['iconButton']}
          aria-label={`${t('modelAdvanced')} ${String(position)}`}
          aria-expanded={props.expanded}
          title={t('modelAdvanced')}
          onClick={(event) => { event.currentTarget.focus(); props.onToggle() }}
        >
          {props.expanded ? <IconChevronDownOutlineRegular /> : <IconChevronRightOutlineRegular />}
        </button>
        <button
          type="button"
          className={`${styles['iconButton']} ${styles['iconButtonDanger']}`}
          aria-label={`${t('removeModel')} ${String(position)}`}
          title={t('removeModel')}
          disabled={disabled}
          onClick={props.onRemove}
        >
          <IconTrashOutlineRegular size={14} />
        </button>
        {modelField('name')}
        {props.expanded
          ? (
            <div className={styles['modelAdvanced']}>
              {(['contextWindow', 'maxTokens'] as const).map(field => (
                <label className={styles['modelField']} key={field}>
                  <span className={styles['modelFieldLabel']}>{t(field)}</span>
                  <input
                    className={styles['input']}
                    type="text"
                    inputMode="numeric"
                    value={props[field].value}
                    placeholder={props[field].placeholder}
                    aria-label={`${t(field)} ${String(position)}`}
                    disabled={disabled}
                    onChange={(event) => { props[field].onChange(event.target.value) }}
                    onBlur={props[field].onBlur}
                  />
                </label>
              ))}
              <ModelInputTypes
                model={model} field={props.inputField} position={position}
                fallback={props.inputFallback} disabled={disabled || props.inputLoading === true} t={t} onChange={props.onChange}
              />
              {props.reasoningLevels !== undefined && props.reasoningLevels.length > 0
                ? (
                  <ModelReasoningEfforts
                    model={model} levels={props.reasoningLevels} position={position} disabled={disabled} t={t} onChange={props.onChange}
                  />
                )
                : null}
              {destination === undefined || routingOptions.length === 0
                ? null
                : (
                  <div className={styles['routingFields']}>
                    <span className={styles['modelFieldLabel']}>{t('peakRouting')}</span>
                    <label className={styles['modelField']}>
                      <span className={styles['modelFieldLabel']}>{t('routingProvider')}</span>
                      <select
                        className={`${styles['input']} ${styles['selectInput']}`}
                        value={destination.provider}
                        aria-label={`${t('routingProvider')} ${String(position)}`}
                        disabled={disabled}
                        onChange={(event) => { editRouting({ provider: event.target.value }) }}
                      >
                        <option value="">{t('routingNone')}</option>
                        {routingOptions.map(option => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles['modelField']}>
                      <span className={styles['modelFieldLabel']}>{t('routingModel')}</span>
                      <select
                        className={`${styles['input']} ${styles['selectInput']}`}
                        value={destination.model}
                        aria-label={`${t('routingModel')} ${String(position)}`}
                        disabled={disabled || destination.provider === ''}
                        onChange={(event) => { editRouting({ model: event.target.value }) }}
                      >
                        {/* The destination model is a choice, not a default: the
                            placeholder asks for one and cannot be selected back. */}
                        <option value="" disabled>{t('routingModelPlaceholder')}</option>
                        {routingModelOptions.map(id => (
                          <option key={id} value={id}>{id}</option>
                        ))}
                      </select>
                    </label>
                    {!destinationChosen
                      ? <p className={styles['routingHint']}>{t('routingHint')}</p>
                      : (
                        <>
                          {/* The period is policy, not a setting: the window is
                              Ollama Cloud's weekday peak, shown in both zones the
                              operator reasons in. */}
                          <div className={styles['routingWindow']}>
                            <span className={styles['modelFieldLabel']}>{t('routingWindow')}</span>
                            <p className={styles['routingWindowValue']}>{windowValue(t)}</p>
                            <p className={styles['routingHint']}>{t('routingPeakNote')}</p>
                          </div>
                        </>
                      )}
                  </div>
                )}
            </div>
          )
          : null}
      </div>
    </div>
  )
}
