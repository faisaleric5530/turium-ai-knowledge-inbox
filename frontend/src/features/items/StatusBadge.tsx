import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ItemStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS: Record<ItemStatus, { label: string; Icon: LucideIcon; className: string }> = {
  pending: { label: 'Queued', Icon: Clock, className: 'bg-warning-bg text-warning border-warning/25' },
  processing: { label: 'Processing', Icon: Loader2, className: 'bg-warning-bg text-warning border-warning/25' },
  ready: { label: 'Ready', Icon: CheckCircle2, className: 'bg-success-bg text-success border-success/25' },
  failed: { label: 'Failed', Icon: AlertCircle, className: 'bg-destructive-bg text-destructive border-destructive/25' },
}

/** Status is always icon + text, never colour alone. */
export function StatusBadge({ status }: { status: ItemStatus }) {
  const { label, Icon, className } = STATUS[status]
  return (
    <Badge className={className}>
      <Icon className={cn(status === 'processing' && 'motion-safe:animate-spin')} aria-hidden />
      {label}
    </Badge>
  )
}
