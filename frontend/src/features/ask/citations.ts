export type AnswerPart =
  | { kind: 'text'; text: string }
  | { kind: 'citation'; index: number }

const CITATION_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g

/** Splits answer text into plain text and citation markers like [1] or [1, 2]. */
export function splitAnswer(answer: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  let cursor = 0

  for (const match of answer.matchAll(CITATION_PATTERN)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push({ kind: 'text', text: answer.slice(cursor, start) })
    for (const raw of match[1].split(',')) {
      parts.push({ kind: 'citation', index: Number(raw.trim()) })
    }
    cursor = start + match[0].length
  }

  if (cursor < answer.length) parts.push({ kind: 'text', text: answer.slice(cursor) })
  return parts
}

/** The sources are a tab pattern: one tab per source, one shared detail panel. */
export const SOURCE_DETAIL_ID = 'source-detail'

export function sourceTabId(index: number): string {
  return `source-tab-${index}`
}
