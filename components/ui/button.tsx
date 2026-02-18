import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-400 bg-[length:200%_auto] text-black shadow-[0_6px_24px_rgba(34,211,238,0.35)] hover:shadow-[0_8px_32px_rgba(34,211,238,0.5)] hover:bg-right",
        destructive:
          "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
        outline:
          "border hover:bg-white/5",
        secondary:
          "bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-400/40 hover:border-purple-400/60 hover:from-purple-500/30 hover:to-cyan-500/30",
        ghost:
          "hover:bg-white/5",
        link:
          "underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5 min-h-[44px]",
        sm: "h-9 px-4 text-xs min-h-[36px]",
        lg: "h-12 px-8 py-3.5 text-base min-h-[48px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={{ color: variant === 'outline' || variant === 'secondary' || variant === 'ghost' ? 'var(--text)' : undefined, borderColor: variant === 'outline' ? 'var(--border)' : undefined }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
