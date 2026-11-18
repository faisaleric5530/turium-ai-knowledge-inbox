import * as React from "react"
import { cn } from "@/lib/utils"

/** Small pill. Colour comes from the caller via className (status tints, navy count). */
function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 font-sans text-xs font-semibold whitespace-nowrap tabular-nums [&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
