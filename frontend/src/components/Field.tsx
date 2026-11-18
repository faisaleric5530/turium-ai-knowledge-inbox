import type { ReactNode } from 'react'

interface FieldProps {
  id: string
  label: string
  optional?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
}

/** Visible label + control + helper/error text. Controls reference `${id}-msg`. */
export function Field({ id, label, optional, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-2 text-sm font-semibold leading-snug">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        )}
      </label>
      {children}
      {(error || hint) && (
        <p
          id={`${id}-msg`}
          className={
            error
              ? 'text-sm font-medium text-destructive'
              : 'text-xs tabular-nums text-muted-foreground'
          }
          role={error ? 'alert' : undefined}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
