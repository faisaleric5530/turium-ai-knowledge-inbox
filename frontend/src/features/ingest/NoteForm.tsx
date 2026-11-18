import { useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useIngest } from '@/api/hooks'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SaveResult } from './SaveResult'

export const NOTE_MAX_CHARS = 20_000

export function NoteForm({ onViewSaved }: { onViewSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const ingest = useIngest()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed) {
      setFieldError('Write something to save.')
      return
    }
    setFieldError(undefined)
    ingest.mutate(
      { type: 'note', content: trimmed, title: title.trim() || undefined },
      {
        onSuccess: () => {
          setTitle('')
          setContent('')
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field id="note-title" label="Title" optional>
        <Input
          id="note-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field
        id="note-content"
        label="Note"
        error={fieldError}
        hint={`${content.length.toLocaleString()} / ${NOTE_MAX_CHARS.toLocaleString()} characters`}
      >
        <Textarea
          id="note-content"
          rows={6}
          className="min-h-36"
          value={content}
          maxLength={NOTE_MAX_CHARS}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby="note-content-msg"
          onChange={(e) => setContent(e.target.value)}
        />
      </Field>

      {ingest.isError && <ErrorNotice error={ingest.error} />}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={ingest.isPending}>
          {ingest.isPending && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
          {ingest.isPending ? 'Saving' : 'Save note'}
        </Button>
        <p role="status" aria-live="polite" className="font-sans text-sm">
          {ingest.isSuccess && <SaveResult message="Saved. Processing now." onViewSaved={onViewSaved} />}
        </p>
      </div>
    </form>
  )
}
