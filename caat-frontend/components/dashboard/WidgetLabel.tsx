// components/dashboard/WidgetLabel.tsx
import { ReactNode } from "react"

interface WidgetLabelProps {
  icon: ReactNode
  title: string
}

export function WidgetLabel({ icon, title }: WidgetLabelProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border m-5 p-2 hover:bg-muted/50 transition">
        <div className="text-xl">{icon}</div>
        <span className="font-medium">{title}</span>
    </div>
  )
}