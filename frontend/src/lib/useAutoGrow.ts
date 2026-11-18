import { useLayoutEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Grows a textarea with its content up to `maxHeight` px, then lets it scroll.
 * The `rows` attribute still sets the starting (minimum) height.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight: number) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.offsetParent === null) return // hidden panel: nothing to measure
    const borders = el.offsetHeight - el.clientHeight
    el.style.height = 'auto'
    const wanted = el.scrollHeight + borders
    el.style.height = `${Math.min(wanted, maxHeight)}px`
    el.style.overflowY = wanted > maxHeight ? 'auto' : 'hidden'
  }, [ref, value, maxHeight])
}
