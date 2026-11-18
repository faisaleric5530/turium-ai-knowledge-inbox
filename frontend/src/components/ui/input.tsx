import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

/** Tinted field; on focus it lightens and takes the primary border plus a soft ring. */
export const fieldClass =
  "w-full min-w-0 rounded-[10px] border-[1.5px] border-input bg-input-bg px-4 font-sans text-[0.9375rem] leading-normal text-foreground transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-placeholder hover:border-primary/60 focus-visible:border-primary focus-visible:bg-input-bg-focus focus-visible:shadow-[0_0_0_3px_rgb(34_57_111/0.12)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(fieldClass, "h-11", className)}
      {...props}
    />
  )
}

export { Input }
