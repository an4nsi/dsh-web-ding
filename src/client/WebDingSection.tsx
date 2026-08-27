import { useEffect, useState } from 'react'
import { getSettings, setSetting, subscribe } from './store.ts'
import { playChime, unlockChime } from './chime.ts'
import { Switch } from './Switch.tsx'
import css from './section.module.css'

/**
 * The "Web Ding" settings section (settings.section slot, order 100 = last in
 * the nav). Visual language mirrors the native pages: content sits inside the
 * shell's padded column, controls live in a hairline-bordered layer-3 card,
 * rows separated by hairlines, all colors via the host's --dsw-alias-* tokens.
 *
 * The shell hands us only { close }; everything else comes from our own
 * store. No locale service — the nav label is the brand name and row copy is
 * hardcoded zh per product decision.
 */

function useStored(key: 'notify' | 'sound'): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => getSettings()[key])
  useEffect(() => subscribe(() => setValue(getSettings()[key])), [key])
  const update = (v: boolean): void => {
    setSetting(key, v)
    setValue(v)
  }
  return [value, update]
}

function permHint(): string {
  if (typeof Notification === 'undefined') return '此浏览器不支持通知'
  if (Notification.permission === 'denied') return '权限已被屏蔽，可到浏览器站点设置里改回允许'
  return ''
}

export function WebDingSection() {
  const [notify, setNotify] = useStored('notify')
  const [sound, setSound] = useStored('sound')
  const hint = notify ? permHint() : ''

  return (
    <div className={css.wrap}>
      <p className={css.desc}>
        主 agent 停止输出时提醒你——切到别的窗口也不错过。
      </p>
      <ul className={css.card}>
        <li className={css.row}>
          <span className={css.texts}>
            <span className={css.title}>任务完成通知</span>
            <span className={css.hint}>
              {hint !== '' ? hint : '系统级通知；开启时会就地请求浏览器权限'}
            </span>
          </span>
          <Switch
            checked={notify}
            onChange={(v) => {
              if (
                v &&
                typeof Notification !== 'undefined' &&
                Notification.permission === 'default'
              ) {
                // onChange runs inside the click gesture.
                void Notification.requestPermission()
              }
              setNotify(v)
            }}
            label="任务完成通知"
          />
        </li>
        <li className={css.row}>
          <span className={css.texts}>
            <span className={css.title}>完成提示音</span>
            <span className={css.hint}>两音符合成音，不依赖系统通知中心；开启时播一声试听</span>
          </span>
          <Switch
            checked={sound}
            onChange={(v) => {
              // The click gesture unlocks the AudioContext; enabling plays a
              // test ping immediately.
              unlockChime()
              if (v) playChime()
              setSound(v)
            }}
            label="完成提示音"
          />
        </li>
      </ul>
    </div>
  )
}
