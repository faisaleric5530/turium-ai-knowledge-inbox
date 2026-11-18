import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { useAsk } from '@/api/hooks'
import { ErrorNotice } from '@/components/ErrorNotice'
import { scrollBehavior } from '@/lib/motion'
import { AnswerSkeleton } from './AnswerSkeleton'
import { AnswerView } from './AnswerView'
import { AskForm } from './AskForm'

interface AskPanelProps {
  onGoToAdd: () => void
  onGoToSaved: () => void
}

/** Results already within this many px of the sticky header are left where they are. */
const RESULTS_NEAR_TOP_MIN = 60
const RESULTS_NEAR_TOP_MAX = 100

export function AskPanel({ onGoToAdd, onGoToSaved }: AskPanelProps) {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const ask = useAsk()
  const resultsRef = useRef<HTMLDivElement>(null)

  function submit() {
    const trimmed = question.trim()
    if (!trimmed || ask.isPending) return
    setAsked(trimmed)
    ask.mutate({ question: trimmed })
  }

  // When a request starts, bring the result area up under the sticky header so the answer
  // and its sources are visible without scrolling. If it is already there, stay put.
  useEffect(() => {
    if (!ask.isPending) return
    const results = resultsRef.current
    if (!results) return
    const top = results.getBoundingClientRect().top
    if (top > RESULTS_NEAR_TOP_MAX || top < RESULTS_NEAR_TOP_MIN) {
      results.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    }
  }, [ask.isPending])

  const needsRoom = ask.isPending || (ask.isSuccess && ask.data.answered)

  const status = ask.isPending
    ? 'Finding an answer…'
    : ask.isError
      ? 'Could not get an answer.'
      : ask.isSuccess
        ? ask.data.answered
          ? 'Answer ready.'
          : 'No relevant context found.'
        : ''

  return (
    <div className="space-y-4">
      <AskForm value={question} onChange={setQuestion} onSubmit={submit} pending={ask.isPending} />

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {/* While loading and for a real answer, leave room below so the page can scroll the
          results up under the header. Compact notices (no result, error) do not need it. */}
      <div
        ref={resultsRef}
        className={cn(
          'border-t border-border-subtle pt-5 empty:hidden',
          needsRoom && 'min-h-[min(calc(100dvh-8rem),40rem)]',
        )}
      >
        {ask.isPending && <AnswerSkeleton />}
        {ask.isError && (
          <ErrorNotice
            error={ask.error}
            onRetry={() => ask.mutate({ question: asked })}
            retrying={ask.isPending}
          />
        )}
        {ask.isSuccess && (
          <AnswerView
            key={ask.submittedAt}
            result={ask.data}
            onGoToAdd={onGoToAdd}
            onGoToSaved={onGoToSaved}
          />
        )}
      </div>
    </div>
  )
}
