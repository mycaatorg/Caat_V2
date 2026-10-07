"use client"

import * as React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  User,
  School,
  FileUser,
  LayoutDashboard,
  FileText,
  BookOpen,
  GraduationCap,
  FolderOpen,
  ClipboardList,
  Users,
  Bookmark,
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
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "./nav-user"
import { useAuth } from "@/components/providers/AuthContext"

const tools = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard" },
  { title: "My Profile", icon: User, url: "/profile" },
  { title: "Schools", icon: School, url: "/schools" },
  { title: "Applications", icon: ClipboardList, url: "/applications" },
  { title: "Majors", icon: BookOpen, url: "/majors" },
  { title: "Resume Builder", icon: FileUser, url: "/resume-builder" },
  { title: "Essays", icon: FileText, url: "/essays" },
  { title: "Scholarships", icon: GraduationCap, url: "/scholarships" },
  { title: "Documents", icon: FolderOpen, url: "/documents" },
]

const community = [
  { title: "Community Campus", icon: Users, url: "/communities" },
  { title: "Saved Posts",  icon: Bookmark, url: "/communities/saved" },
]

export function AppSidebar({
  initialAvatarUrl = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & { initialAvatarUrl?: string | null }) {
  const pathname = usePathname()
  // C5: read the already-resolved user from AuthContext instead of firing this
  // sidebar's own getUser() + profile fetch on every navigation. The avatar is
  // resolved once server-side and passed in.
  const { user: authUser } = useAuth()

  // On phones the menu is an overlay over the page; close it once a link has
  // navigated, so the student lands on the page they chose.
  const { isMobile, setOpenMobile } = useSidebar()
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  // NavUser mounts a Radix dropdown; render it only after hydration so it never
  // SSRs. The sidebar's collapsed-state tooltips make Radix's useId sequence
  // differ between server and client, which would surface as a hydration
  // mismatch on the dropdown's id if NavUser were server-rendered. The user is
  // still resolved without a network call (from AuthContext), so this only
  // defers the footer avatar by one frame, exactly as before Phase 3.
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const user = authUser
    ? {
        name:
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "User",
        email: authUser.email ?? "",
        avatar:
          initialAvatarUrl ?? authUser.user_metadata?.avatar_url ?? "",
      }
    : null

  return (
    <Sidebar {...props}>
      <SidebarHeader className="py-5 px-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="inline-flex items-center focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-sidebar-ring focus-visible:outline-offset-2">
          <div className="relative h-8 w-24">
            <Image
              src="/logo.png"
              alt="CAAT"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => {
                const isActive =
                  item.url === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="gap-3 px-4 py-2.5 rounded-none text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-[#9a1a27] data-[active=true]:text-white data-[active=true]:hover:bg-[#9a1a27] data-[active=true]:hover:text-white data-[active=true]:font-medium transition-colors duration-100"
                    >
                      <Link href={item.url}>
                        <item.icon className="size-4 shrink-0" strokeWidth={1.5} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-2">
          <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1">
            Community
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {community.map((item) => {
                const isActive = pathname.startsWith(item.url)
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="gap-3 px-4 py-2.5 rounded-none text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-[#9a1a27] data-[active=true]:text-white data-[active=true]:hover:bg-[#9a1a27] data-[active=true]:hover:text-white data-[active=true]:font-medium transition-colors duration-100"
                    >
                      <Link href={item.url}>
                        <item.icon className="size-4 shrink-0" strokeWidth={1.5} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {mounted && user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
