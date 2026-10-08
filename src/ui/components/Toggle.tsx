interface Props {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** A native checkbox drawn as a switch: the label is the whole hit area. */
export function Toggle({ label, hint, checked, disabled, onChange }: Props) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-4 has-[:disabled]:cursor-not-allowed">
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-chalk-dim">{hint}</span>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full bg-slate-3 transition-colors duration-150 peer-checked:bg-best peer-disabled:opacity-40 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-best after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-chalk after:transition-transform after:duration-150 peer-checked:after:translate-x-5 peer-checked:after:bg-slate"
      />
    </label>
  )
}
