import { SidebarTrigger } from "@/components/ui/sidebar";
import ResumeBuilderClient from "./client";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default function ResumeBuilderPage() {
  return <>
    <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink>Resume Builder</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      
    <ResumeBuilderClient />
  </>
}
