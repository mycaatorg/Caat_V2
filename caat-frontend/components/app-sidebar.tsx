"use client"

import * as React from "react"

import logo from "@/components/assets/logo.webp"
import Image from "next/image"
import {
  User, 
  School, 
  FileUser, 
  LayoutDashboard
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel
} from "@/components/ui/sidebar"
import { Card } from "@/components/ui/card"

// This is sample data.
const data = {
  apps: [
    { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard", },
    { title: "My Profile", icon: User, url: "/profile", },
    { title: "Schools", icon: School, url: "/schools", },
    { title: "Resume Builder", icon: FileUser, url: "/resume-builder", },
  ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-0">
        <Card className="m-2">
          {/* Header container with your branding color #8b1723 */}
          <div className="flex items-center px-8">
            <div className="relative h-10 w-32">
              <Image 
                src={logo} 
                alt="myCAAT Logo" 
                fill 
                className="object-contain object-left"
                priority
              />
            </div>
          </div>
        </Card>
      </SidebarHeader>

      <SidebarContent className="">
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            {/* <SidebarMenu> */}
              {data.apps.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon/>
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            {/* </SidebarMenu> */}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
