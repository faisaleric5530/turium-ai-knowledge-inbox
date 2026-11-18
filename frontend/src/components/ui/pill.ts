import { cn } from "@/lib/utils"

/**
 * Pill tab look shared by the primary tabs and the Note / Web page switch:
 * transparent with a 1.5px border, filled primary when active.
 */
const pillBase =
  "inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 rounded-full border-[1.5px] px-4 font-sans text-[0.8125rem] font-semibold whitespace-nowrap transition-[background-color,border-color,color] duration-200"

export const pillIdle =
  "border-border bg-transparent text-muted-foreground hover:border-border-hover hover:text-foreground"

export const pillActive =
  "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"

/** Class names for a pill built from plain buttons (selected state passed in). */
export function pillClass(selected: boolean, className?: string) {
  return cn(pillBase, selected ? pillActive : pillIdle, className)
}

/** Same look for base-ui tabs, which expose their state as the data-active attribute. */
export const pillDataClass = cn(
  pillBase,
  pillIdle,
  "data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary-hover data-active:hover:text-primary-foreground",
)
