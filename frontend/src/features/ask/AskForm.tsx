import { useRef } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAutoGrow } from '@/lib/useAutoGrow'

export const QUESTION_MAX_CHARS = 1_000
const MAX_GROWN_HEIGHT_PX = 148 // about five lines, then the box scrolls

interface AskFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  pending: boolean
}

/**
 * Compact question form: two lines tall, growing to about five. The Ask button always sits
 * below the box (full width on phones, natural width on larger screens).
 */
export function AskForm({ value, onChange, onSubmit, pending }: AskFormProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(ref, value, MAX_GROWN_HEIGHT_PX)
  const canSubmit = value.trim() !== '' && !pending

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (canSubmit) onSubmit()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-1.5"
    >
      <label htmlFor="question" className="text-sm font-semibold leading-snug">
        Your question
      </label>
      <Textarea
        id="question"
        ref={ref}
        rows={2}
        value={value}
        maxLength={QUESTION_MAX_CHARS}
        aria-describedby="question-msg"
        className="min-h-0 resize-none py-2.5 leading-6"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <p id="question-msg" className="text-xs tabular-nums text-muted-foreground">
        {value.length.toLocaleString()} / {QUESTION_MAX_CHARS.toLocaleString()} characters. Press
        Ctrl+Enter to ask.
      </p>
      <Button
        type="submit"
        disabled={!canSubmit}
        className="mt-1.5 w-full sm:w-auto sm:self-start"
      >
        {pending ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
        {pending ? 'Thinking' : 'Ask'}
      </Button>
    </form>
  )
}
