import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl px-4 py-3 text-base outline-none transition-all min-h-[44px] focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{ background: "var(--panel2)", color: "var(--text)", border: "1px solid var(--border)" }}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
