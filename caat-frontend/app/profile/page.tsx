import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"

export default function ProfilePage() {
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
              <BreadcrumbLink>My Profile</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>


      <div className="flex flex-1 flex-col items-center p-4">
        <div className="w-full max-w-3xl p-4">
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="Name">Name</FieldLabel>
                <Input
                  id="First Name"
                  placeholder="First Name"
                />  
                <Input
                  id="Last Name"
                  placeholder="Last Name"
                />
              </Field>
            </FieldGroup>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="Name">Email</FieldLabel>
                <Input
                  id="Email"
                  placeholder="jane.doe@email.com"
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>
      </div>
    </>
  )
}