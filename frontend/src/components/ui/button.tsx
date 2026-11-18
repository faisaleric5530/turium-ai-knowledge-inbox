import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-transparent px-5 font-sans text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-primary hover:bg-primary-hover motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0",
        outline:
          "border-input bg-card text-foreground hover:bg-primary-light",
        ghost: "px-3 text-foreground hover:bg-primary-light",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Button }
