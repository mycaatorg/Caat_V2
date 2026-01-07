// components/dashboard/WidgetSection.tsx
interface WidgetSectionProps {
  title: string
  children: React.ReactNode
}

export function WidgetSection({ title, children }: WidgetSectionProps) {
  return (
    <section className="space-y-3 m-4">
      <div className="flex items-center gap-4 mx-4">
        <div className="flex-1 border-t" />
        <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
        <div className="flex-1 border-t" />
        </div>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}