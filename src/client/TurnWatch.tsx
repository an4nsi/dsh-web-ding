import { useEffect, useRef } from 'react'
import { getSettings, subscribe } from './store.ts'
import { playChime } from './chime.ts'
import { sendTurnEnd } from './notify.ts'

// Self-contained prop typing against the ONE hook proven present on rc.7
// (ui-jobs uses `useSessions` in this very slot): the session-list store's
// byId[sessionId] row carries live `running` + `displayTitle`.
interface SessionRow {
  running?: boolean
  displayTitle?: string
}

export interface TurnWatchProps {
  sessionId: string
  useSessions: <T>(
    selector: (state: { byId: Record<string, SessionRow | undefined> }) => T,
  ) => T
}

/**
 * Invisible turn-end engine. Renders nothing — it exists so the plugin has a
 * mounted fiber in the conversation (the header-actions slot) whose effects
 * can watch the running flag. The visible controls live in the official
 * Settings page (see SettingsRows.tsx).
 */
export function TurnWatch({ sessionId, useSessions }: TurnWatchProps) {
  const running = useSessions((s) => s.byId[sessionId]?.running === true)
  const displayTitle = useSessions((s) => s.byId[sessionId]?.displayTitle)

  const prevRunning = useRef<boolean | null>(null)
  const prevSession = useRef<string | null>(null)
  const settingsRef = useRef(getSettings())
  useEffect(
    () =>
      subscribe(() => {
        settingsRef.current = getSettings()
      }),
    [],
  )

  useEffect(() => {
    // Switching sessions re-baselines instead of firing for the previous one.
    if (prevSession.current !== sessionId) {
      prevSession.current = sessionId
      prevRunning.current = running
      return
    }
    const prev = prevRunning.current
    prevRunning.current = running
    if (prev !== true || running !== false) return

    const { notify, sound } = settingsRef.current
    console.info(`[dsh-web-ding] turn end (notify=${notify} sound=${sound})`)
    if (notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void sendTurnEnd(`${displayTitle ?? '会话'}：agent 已停止输出`, sessionId)
    }
    if (sound) playChime()
  }, [running, displayTitle, sessionId])

  return null
}
