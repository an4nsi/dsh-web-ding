import css from './Switch.module.css'

/**
 * Boolean control following DSH-better-sidebar's canonical recipe: a real,
 * visually-hidden native checkbox (semantics + keyboard focus intact) driving
 * a styled track/thumb. The framework ships no Toggle/Switch primitive.
 */
export function Switch(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className={css.switch}>
      <input
        type="checkbox"
        className={css.switchInput}
        checked={props.checked}
        aria-label={props.label}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
      <span className={css.switchTrack} aria-hidden="true">
        <span className={css.switchThumb} />
      </span>
    </label>
  )
}
