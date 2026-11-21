/** Host model catalog shared by the task editor's model and reasoning rows. */
import type { ModelCatalog, ModelCatalogModel, ModelProviderGroup, RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ScheduleModelSelection } from '@deepseek-ai/dsh-schedule/client'

/** Load state of the Host model catalog a creation target chooses a route from. */
export interface ModelCatalogSnapshot {
  /** Read lifecycle; `ready` means `catalog` came from a successful read. */
  readonly status: 'loading' | 'ready' | 'error'
  /** Last successfully read catalog; a failed read keeps the previous value. */
  readonly catalog: ModelCatalog | undefined
}

/** Selector-hook face of the shared model catalog source. */
export interface ModelCatalogInjected {
  /** Host model catalog observable, bound to the `useModelCatalog` selector hook. */
  readonly hooks: { readonly modelCatalog: HostObservable<ModelCatalogSnapshot> }
}

/** Shared model catalog read plus the retry and invalidation its consumers offer. */
export interface ModelCatalogSource extends ModelCatalogInjected {
  /**
   * Read the catalog again after a failure.
   * @returns resolution after the read publishes its result.
   */
  readonly onRetry: () => Promise<void>
  /**
   * Reread after the Host's providers, models, settings, or credentials changed.
   * A mounted editor keeps the previous catalog visible until the read settles; without a subscriber the next mount reads.
   */
  readonly refresh: () => void
  /** Drop the previous Host generation's catalog and reread when a subscriber is mounted. */
  readonly reset: () => void
}

/** One selectable provider/model route advertised by the Host. */
export interface ModelRoute {
  /** Provider group the model belongs to. */
  readonly provider: ModelProviderGroup
  /** Catalog entry of the model within that provider. */
  readonly model: ModelCatalogModel
}

/**
 * Build the menu identity of one provider/model pair.
 *
 * The pair is the unit because one model id can be served by several
 * providers.
 * @param route - provider and model ids.
 * @returns an identity unique across provider groups.
 */
export function modelRouteId(route: { readonly provider: string; readonly model: string }): string {
  return JSON.stringify([route.provider, route.model])
}

/**
 * Flatten the catalog's provider groups into selectable routes.
 * @param catalog - Host model catalog, or undefined before the first successful read.
 * @returns every advertised route in provider and model order.
 */
export function modelRoutes(catalog: ModelCatalog | undefined): readonly ModelRoute[] {
  return catalog === undefined ? [] : catalog.groups.flatMap(provider => provider.models.map(model => ({ provider, model })))
}

/**
 * Resolve a stored or selected route against the advertised routes.
 * @param routes - routes produced by {@link modelRoutes}.
 * @param selection - provider and model ids to look up.
 * @returns the advertised route, or undefined when the catalog omits that pair.
 */
export function findModelRoute(routes: readonly ModelRoute[], selection: ScheduleModelSelection): ModelRoute | undefined {
  return routes.find(route => route.provider.id === selection.provider && route.model.id === selection.model)
}

/**
 * Read the Host model catalog once for every mounted task editor.
 *
 * The first subscriber starts the read, so the Tasks page and the task tab
 * share one request and one snapshot. A successful read stays until the Host
 * reports a model input change or drops the connection; a failed read keeps the
 * last successful catalog for the current selection's label.
 * @param load - Host model catalog request.
 * @returns the shared observable, the retry after a failed read, and the invalidation verbs.
 */
export function createModelCatalogSource(load: () => Promise<RemoteResult<ModelCatalog>>): ModelCatalogSource {
  let snapshot: ModelCatalogSnapshot = { status: 'loading', catalog: undefined }
  let generation = 0
  const listeners = new Set<() => void>()
  const publish = (next: ModelCatalogSnapshot): void => {
    snapshot = next
    for (const listener of listeners) listener()
  }
  let inFlight: Promise<void> | undefined
  const read = (): Promise<void> => {
    if (inFlight !== undefined) return inFlight
    const request = generation
    publish({ ...snapshot, status: 'loading' })
    const pending = (async (): Promise<void> => {
      let result: RemoteResult<ModelCatalog>
      try {
        result = await load()
      } catch (_error: unknown) {
        // A rejected request leaves the catalog unknown, so its consumers offer the same retry as a Remote failure.
        if (request === generation) publish({ ...snapshot, status: 'error' })
        return
      }
      // A read issued for the previous Host generation must not overwrite the current one.
      if (request !== generation) return
      publish(result.ok
        ? { status: 'ready', catalog: result.value }
        : { status: 'error', catalog: snapshot.catalog })
    })().finally(() => { if (inFlight === pending) inFlight = undefined })
    inFlight = pending
    return pending
  }
  return {
    hooks: {
      modelCatalog: {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          // The first mount starts the read; a remount after a failed or dropped read starts a fresh one.
          if (inFlight === undefined && snapshot.status !== 'ready') void read()
          return () => { listeners.delete(listener) }
        },
      },
    },
    onRetry: async () => {
      await read()
    },
    refresh: () => {
      if (listeners.size > 0) {
        void read()
        return
      }
      // No mounted editor: mark the catalog stale so the next mount reads instead of reusing it.
      publish({ ...snapshot, status: 'loading' })
    },
    reset: () => {
      // Ignore the in-flight answer of the Host generation this replaces.
      generation += 1
      inFlight = undefined
      publish({ status: 'loading', catalog: undefined })
      if (listeners.size > 0) void read()
    },
  }
}
