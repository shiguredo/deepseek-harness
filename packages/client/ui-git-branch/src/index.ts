/**
 * Git-branch chip plugin, node half. Pure UI plugin: the empty apply exists
 * so the package appears in the host cordis.yml / Loader; the browser half
 * ships via exports["./client"], discovered through the package.json
 * dsh.client declaration.
 */

/** Host plugin body — no host-side behavior for this browser plugin. */
export function apply(): void {}
