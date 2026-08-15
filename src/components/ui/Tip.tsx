import type { ReactNode } from 'react'

/**
 * Hover label: the name of the control plus its keyboard shortcut.
 * Pure CSS, so it never lags behind the pointer the way `title` does.
 */
export function Tip({
  label,
  hint,
  side = 'right',
  children,
}: {
  label: string
  hint?: string
  side?: 'right' | 'bottom'
  children: ReactNode
}) {
  const place =
    side === 'right'
      ? 'top-1/2 left-full ml-2 -translate-y-1/2'
      : 'top-full left-1/2 mt-2 -translate-x-1/2'

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 flex items-center gap-1.5 rounded-md border border-ink-600
                    bg-ink-800 px-2 py-1 whitespace-nowrap text-mist-200 opacity-0 shadow-lg
                    transition-opacity delay-100 duration-100 group-hover:opacity-100 ${place}`}
      >
        {label}
        {hint ? <kbd>{hint}</kbd> : null}
      </span>
    </span>
  )
}
