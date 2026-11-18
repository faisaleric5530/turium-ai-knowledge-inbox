import * as React from "react"
import { cn } from "@/lib/utils"

/** The one surface of the app: light card, 1.5px border, soft shadow. */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "overflow-hidden rounded-[14px] border-[1.5px] border-border bg-card text-card-foreground shadow-md sm:rounded-[18px]",
        className
      )}
      {...props}
    />
  )
}

export { Card }
