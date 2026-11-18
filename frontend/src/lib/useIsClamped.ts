import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Tells whether a line-clamped element is actually cutting text off, so a
 * "Show more" control only appears when it is useful. Re-measures on resize.
 * While `clamping` is false (expanded) the last result is kept, so the
 * "Show less" control stays available.
 */
export function useIsClamped<T extends HTMLElement>(clamping: boolean, contentKey: string) {
  const ref = useRef<T>(null)
  const [clamped, setClamped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !clamping) return
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [clamping, contentKey])

  return [ref, clamped] as const
}
