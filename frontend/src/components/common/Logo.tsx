import { ShoppingBag } from "lucide-react"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  showText?: boolean
}

const sizeMap = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
}

const textSizeMap = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
}

export function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-lg bg-primary p-1.5">
        <ShoppingBag className={`${sizeMap[size]} text-primary-foreground`} />
      </div>
      {showText && (
        <span className={`${textSizeMap[size]} font-bold tracking-tight text-foreground`}>
          Zap<span className="text-primary">Catalog</span>
        </span>
      )}
    </div>
  )
}
