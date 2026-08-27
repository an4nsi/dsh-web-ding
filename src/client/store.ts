/** Tiny localStorage-backed pub/sub so the Settings-page rows and the
 * always-on turn watcher share one fact source. localStorage (not the
 * official settingsScope) on purpose: behind a reverse proxy the framework's
 * settings transport degrades to in-memory (settings-scope.ts chooses
 * 'host' only for loopback connections), which would reset on every reload.
 */
export interface DingSettings {
  /** System notification fires when the main agent stops outputting. */
  notify: boolean
  /** Two-note C5→E5 chime fires alongside (or instead of) the notification. */
  sound: boolean
}

const KEY = 'dsh-web-ding.settings'

function load(): DingSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<DingSettings>
      return { notify: parsed.notify === true, sound: parsed.sound === true }
    }
  } catch {
    /* corrupted or unavailable storage — fall through to defaults */
  }
  return { notify: false, sound: false }
}

let current: DingSettings = load()
const subscribers = new Set<() => void>()

export function getSettings(): DingSettings {
  return current
}

export function setSetting<K extends keyof DingSettings>(key: K, value: boolean): void {
  if (current[key] === value) return
  current = { ...current, [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* non-fatal */
  }
  for (const notify of subscribers) notify()
}

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}
