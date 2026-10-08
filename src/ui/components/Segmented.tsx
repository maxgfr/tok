import { useId } from 'react'

interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface Props<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

/** Mutually exclusive choices — native radios drawn as one bar. */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const name = useId()
  return (
    <fieldset className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-slate-2 p-1">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => {
        const active = o.value === value
        return (
          <label
            key={o.value}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg px-3 text-center text-base font-semibold transition-colors duration-150 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-chalk-faint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-best ${
              active ? 'bg-chalk text-slate' : 'text-chalk-dim hover:text-chalk'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        )
      })}
    </fieldset>
  )
}
