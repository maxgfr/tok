import { Activity, History, Play, Settings } from 'lucide-react'
import type { Route } from '../router.ts'

const ITEMS = [
  { href: '#/', label: 'Play', icon: Play, match: ['home'] },
  { href: '#/history', label: 'History', icon: History, match: ['history', 'session', 'replay'] },
  { href: '#/lab', label: 'Lab', icon: Activity, match: ['lab'] },
  { href: '#/settings', label: 'Settings', icon: Settings, match: ['settings'] },
] as const

export function BottomNav({ route }: { route: Route }) {
  return (
    <nav aria-label="Main" className="safe-bottom safe-x border-t border-rule bg-slate">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = (match as readonly string[]).includes(route.name)
          return (
            <li key={href}>
              <a
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold no-underline ${
                  active ? 'text-chalk' : 'text-chalk-faint hover:text-chalk-dim'
                }`}
              >
                <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
