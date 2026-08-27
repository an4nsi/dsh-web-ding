/** Robust send path (MDN pattern): prefer an existing service worker
 * registration's showNotification(), fall back to the page-level
 * Notification() constructor. Both are the official Web Notifications API.
 */
export async function sendTurnEnd(body: string, sessionId: string): Promise<void> {
  const opts: NotificationOptions & { tag?: string } = {
    body,
    tag: `turn-${sessionId}-${Date.now()}`,
  }
  const log = '[dsh-web-ding]'
  try {
    const reg =
      typeof navigator !== 'undefined' && navigator.serviceWorker?.controller
        ? await navigator.serviceWorker.getRegistration()
        : undefined
    if (reg) {
      await reg.showNotification('任务完成', opts)
      console.info(`${log} shown via ServiceWorkerRegistration`)
      return
    }
    const n = new Notification('任务完成', opts)
    n.addEventListener('show', () => console.info(`${log} browser accepted ('show' fired)`))
    n.addEventListener('error', (e) => console.error(`${log} notification error event`, e))
    n.addEventListener('click', () => {
      window.focus()
      n.close()
    })
  } catch (err) {
    console.error(`${log} failed to show notification`, err)
  }
}
