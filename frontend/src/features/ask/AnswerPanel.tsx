import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SectionLabel } from '@/components/SectionLabel'
import { cn } from '@/lib/utils'
import { useIsClamped } from '@/lib/useIsClamped'
import { SOURCE_DETAIL_ID, splitAnswer } from './citations'

interface AnswerPanelProps {
  answer: string
  model: string | null
  /** Source numbers that exist; a [n] for anything else is shown as plain text. */
  sourceIndexes: ReadonlySet<number>
  /** The source currently open in the detail panel, to mark its chip. */
  selected: number | undefined
  onCite: (index: number) => void
}

/**
 * The answer text with clickable [n] chips. Long answers are clamped (with Show more)
 * so the sources below stay within reach without scrolling.
 */
export function AnswerPanel({ answer, model, sourceIndexes, selected, onCite }: AnswerPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [textRef, clamped] = useIsClamped<HTMLParagraphElement>(!expanded, answer)

  return (
    <section aria-labelledby="answer-heading" className="space-y-2">
      <SectionLabel id="answer-heading" aside={model ? `Answered by ${model}` : undefined}>
        Answer
      </SectionLabel>

      <p
        ref={textRef}
        id="answer-text"
        className={cn(
          'whitespace-pre-wrap font-body text-[0.9375rem] leading-[1.65]',
          !expanded && 'line-clamp-8 sm:line-clamp-10',
        )}
      >
        {splitAnswer(answer).map((part, position) => {
          if (part.kind === 'text') return <span key={position}>{part.text}</span>
          if (!sourceIndexes.has(part.index)) {
            return (
              <span key={position} className="text-muted-foreground">
                [{part.index}]
              </span>
            )
          }
          const isSelected = part.index === selected
          return (
            <button
              key={position}
              type="button"
              onClick={() => onCite(part.index)}
              aria-label={`Show source ${part.index}`}
              aria-controls={SOURCE_DETAIL_ID}
              aria-pressed={isSelected}
              className={cn(
                'mx-0.5 inline-flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-md px-1.5 align-baseline font-sans text-xs font-semibold tabular-nums transition-colors duration-200',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-navy-50 text-primary hover:bg-navy-100',
              )}
            >
              {part.index}
            </button>
          )
        })}
      </p>

      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="answer-text"
          className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-sans text-xs font-semibold text-primary underline-offset-4 hover:underline sm:min-h-8"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="size-3.5" aria-hidden />
            </>
          ) : (
            <>
              Show full answer <ChevronDown className="size-3.5" aria-hidden />
            </>
          )}
        </button>
      )}
    </section>
  )
}
