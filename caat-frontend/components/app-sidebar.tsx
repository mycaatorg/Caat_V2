"use client"

import * as React from "react"

import logo from "@/components/assets/logo.webp"
import Image from "next/image"
import {
  User,
  School,
  FileUser,
  LayoutDashboard,
  FileText,
  BookOpen,
  GraduationCap,
  FolderOpen,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { supabase } from "@/src/lib/supabaseClient"

const apps = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  { title: "My Profile", icon: User, url: "/profile" },
  { title: "Schools", icon: School, url: "/schools" },
  { title: "Majors", icon: BookOpen, url: "/majors" },
  { title: "Resume Builder", icon: FileUser, url: "/resume-builder" },
  { title: "Essays", icon: FileText, url: "/essays" },
  { title: "Scholarships", icon: GraduationCap, url: "/scholarships" },
  { title: "Documents", icon: FolderOpen, url: "/documents" },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<{ name: string; email: string; avatar: string } | null>(null)

  React.useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "User"
        setUser({
          name,
          email: authUser.email ?? "",
          avatar: authUser.user_metadata?.avatar_url ?? "",
        })
      }
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const authUser = session.user
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "User"
        setUser({
          name,
          email: authUser.email ?? "",
          avatar: authUser.user_metadata?.avatar_url ?? "",
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader className="py-5 px-6 border-b border-sidebar-border">
        
        <div className="relative h-11 w-36 items-center justify-center">
          <Image 
            src={logo} 
            alt="myCAAT Logo" 
            fill 
            className="object-contain object-left"
            priority
          />
        </div>
      
      </SidebarHeader>

      <SidebarContent className="">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest font-semibold px-4 mb-1">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {apps.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="gap-3 px-4 py-2.5 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
                    <a href={item.url}>
                      <item.icon className="size-4 shrink-0"/>
                      <span className="text-sm font-medium">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
