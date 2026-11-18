import * as React from "react"
import { cn } from "@/lib/utils"
import { fieldClass } from "./input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "flex min-h-28 resize-y py-3", className)}
      {...props}
    />
  )
}

export { Textarea }
