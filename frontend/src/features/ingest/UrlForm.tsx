import { useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { existingItemId } from '@/api/client'
import { useIngest } from '@/api/hooks'
import { ErrorNotice } from '@/components/ErrorNotice'
import { Field } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SaveResult } from './SaveResult'

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function UrlForm({ onViewSaved }: { onViewSaved: () => void }) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const ingest = useIngest()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!isHttpUrl(trimmed)) {
      setFieldError('Enter a full web address starting with http:// or https://')
      return
    }
    setFieldError(undefined)
    ingest.mutate(
      { type: 'url', url: trimmed, title: title.trim() || undefined },
      {
        onSuccess: () => {
          setUrl('')
          setTitle('')
        },
      },
    )
  }

  const alreadySaved = ingest.error?.status === 409
  const duplicateId = existingItemId(ingest.error)

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field id="url-input" label="Web address" error={fieldError}>
        <Input
          id="url-input"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://example.com/article"
          value={url}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby="url-input-msg"
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>

      <Field id="url-title" label="Title" optional>
        <Input
          id="url-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      {ingest.isError && (
        <ErrorNotice
          error={ingest.error}
          message={
            alreadySaved
              ? `This page is already saved${duplicateId ? ` (item ${duplicateId.slice(0, 8)})` : ''}.`
              : undefined
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={ingest.isPending}>
          {ingest.isPending && <Loader2 className="motion-safe:animate-spin" aria-hidden />}
          {ingest.isPending ? 'Saving' : 'Save web page'}
        </Button>
        <p role="status" aria-live="polite" className="font-sans text-sm">
          {ingest.isSuccess && (
            <SaveResult message="Saved. Fetching the page now." onViewSaved={onViewSaved} />
          )}
        </p>
      </div>
    </form>
  )
}
