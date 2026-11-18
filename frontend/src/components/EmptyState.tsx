import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}

/** Calm, centred empty state with an icon avatar, short copy and an optional action. */
export function EmptyState({ icon: Icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-navy-50 text-primary">
        <Icon className="size-5" strokeWidth={1.85} aria-hidden />
      </span>
      <h3 className="mt-1 text-base">{title}</h3>
      <p className="max-w-xs font-body text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
