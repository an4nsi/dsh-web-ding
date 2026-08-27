/**
 * Turn-end chime: a two-note sine motif (C5 -> E5), synthesized live via the
 * Web Audio API — no audio assets.
 *
 * Ported from agegr/pi-web, `hooks/useAudio.ts` (`playTone`):
 *   https://github.com/agegr/pi-web/blob/v0.8.8/hooks/useAudio.ts
 * Copyright (c) 2026 agegr — MIT License.
 * The note frequencies, spacing, and gain envelope are unchanged from
 * upstream; the React hook around them was reduced to this plain module.
 */

/** C5 then E5 — the major-third "ding-ding ↑". */
const NOTE_HZ = [523.25, 659.25]

let ctxRef: AudioContext | null = null

function getCtx(): AudioContext | null {
  // Reuse one context so it stays unlocked after the first user gesture.
  if (ctxRef !== null && ctxRef.state !== 'closed') return ctxRef
  try {
    ctxRef = new AudioContext()
  } catch {
    return null
  }
  return ctxRef
}

/** Call from any user gesture: autoplay policy suspends fresh contexts until one happens. */
export function unlockChime(): void {
  const ctx = getCtx()
  if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

export function playChime(): void {
  const ctx = getCtx()
  if (ctx === null) return
  const play = (): void => {
    try {
      const now = ctx.currentTime
      for (const [i, freq] of NOTE_HZ.entries()) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = now + i * 0.18
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
        osc.start(t)
        osc.stop(t + 0.45)
      }
    } catch {
      /* AudioContext unavailable */
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(play).catch(() => {})
    return
  }
  play()
}
