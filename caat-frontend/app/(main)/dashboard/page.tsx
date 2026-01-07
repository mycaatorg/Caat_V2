import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Menu, ListTodo, CalendarDays, Newspaper, University } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { WidgetLabel } from "@/components/dashboard/WidgetLabel"
import { WidgetSection } from "@/components/dashboard/WidgetSection"
import { getWidgetsFromDB } from "@/components/dashboard/api"

const iconMap = {
  list_todo: <ListTodo />,
  calendar: <CalendarDays />,
  news: <Newspaper />,
  university: <University />
}

export default async function DashboardPage() {
  const widgets = await getWidgetsFromDB()


  const main = widgets
    .filter(w => w.position === 'main')
    .sort((a, b) => a.order - b.order)
    
  const active = widgets
    .filter(w => w.position === 'active')
    .sort((a, b) => a.order - b.order)

  const hidden = widgets
    .filter(w => w.position === 'hidden')
    .sort((a, b) => a.order - b.order)

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="ml-auto" />

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Dashboard Widgets</SheetTitle>
              <SheetDescription>
                Rearrange your preference of widgets here.
              </SheetDescription>
            </SheetHeader>
              <WidgetSection title="Main">
                {main.map(widget => (
                  <WidgetLabel
                    key={widget.id}
                    icon={iconMap[widget.type as keyof typeof iconMap]}
                    title={widget.title}
                  />
                ))}
              </WidgetSection>
              <WidgetSection title="Active">
                {active.map(widget => (
                  <WidgetLabel
                    key={widget.id}
                    icon={iconMap[widget.type as keyof typeof iconMap]}
                    title={widget.title}
                  />
                ))}
              </WidgetSection>
              <WidgetSection title="Hidden">
                {hidden.map(widget => (
                  <WidgetLabel
                    key={widget.id}
                    icon={iconMap[widget.type as keyof typeof iconMap]}
                    title={widget.title}
                  />
                ))}
              </WidgetSection>
            <SheetFooter>
              <Button type="submit">Save changes</Button>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </header>
      
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Card className="min-h-[100vh] flex-1 rounded-xl md:min-h-min"></Card>
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <Card className="aspect-video rounded-xl"></Card>        
          <Card className="aspect-video rounded-xl"></Card>        
          <Card className="aspect-video rounded-xl"></Card>        
        </div>        
      </div>
    </>
  )
}