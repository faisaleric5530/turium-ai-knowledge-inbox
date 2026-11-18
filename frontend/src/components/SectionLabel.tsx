import type { ReactNode } from 'react'

interface SectionLabelProps {
  id?: string
  children: ReactNode
  /** Quiet text aligned to the right (e.g. a count). */
  aside?: ReactNode
}

/** Small Inter label that titles a block inside the card. */
export function SectionLabel({ id, children, aside }: SectionLabelProps) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 id={id} className="shrink-0 font-sans text-sm font-semibold">
        {children}
      </h3>
      {aside && <span className="min-w-0 truncate text-xs tabular-nums text-muted-foreground">{aside}</span>}
    </div>
  )
}
