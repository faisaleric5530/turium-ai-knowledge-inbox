import { CheckCircle2 } from 'lucide-react'

interface SaveResultProps {
  message: string
  onViewSaved: () => void
}

/** Inline success line after saving, with a way to jump to the Saved tab. */
export function SaveResult({ message, onViewSaved }: SaveResultProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 font-sans text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-success">
        <CheckCircle2 className="size-4" aria-hidden /> {message}
      </span>
      <button
        type="button"
        onClick={onViewSaved}
        className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-primary underline underline-offset-4 hover:text-primary-hover"
      >
        View in Saved
      </button>
    </span>
  )
}
