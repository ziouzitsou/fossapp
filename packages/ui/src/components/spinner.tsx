import { cn } from "../utils"
import { FossSpinner } from "@/components/foss-spinner"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "auto" | "light" | "dark"
}

const sizeMap = {
  sm: 20,
  md: 32,
  lg: 48,
  xl: 64,
}

export function Spinner({ size = "md", variant = "auto", className, ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      <FossSpinner size={sizeMap[size]} variant={variant} />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
