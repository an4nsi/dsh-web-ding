/**
 * dsh-web-ding — host half.
 *
 * Pure web plugin: the browser half (exports["./client"]) does all the work.
 * The empty host apply exists so the package loads through the cordis Loader
 * and appears in the plugin inventory. No host-side behavior is needed for a
 * browser notification — the job-state mirror is already pushed to the client
 * (state.jobsBySession[sessionId]) by the session client runtime.
 */
export const name = 'dsh-web-ding'

// Host Context is unused for this plugin; the client half owns the behavior.
export function apply(): void {}
