import { useCallback, useEffect, useRef, useState } from 'react'

const FEEDBACK_MS = 1800

type CopyState = 'idle' | 'copied' | 'failed'

/** Copies text to the clipboard (with a textarea fallback) and reports brief feedback. */
export function useCopy(): { state: CopyState; copy: (text: string) => Promise<void> } {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async (text: string) => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = legacyCopy(text)
    }
    setState(ok ? 'copied' : 'failed')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), FEEDBACK_MS)
  }, [])

  return { state, copy }
}

/** Fallback for insecure contexts or denied clipboard permission. */
function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  const previouslyFocused = document.activeElement as HTMLElement | null
  field.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  field.remove()
  previouslyFocused?.focus({ preventScroll: true })
  return ok
}
