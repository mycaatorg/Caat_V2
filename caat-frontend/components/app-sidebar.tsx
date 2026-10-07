"use client"

import * as React from "react"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  School,
  FileUser,
  FileText,
  BookOpen,
  GraduationCap,
  FolderOpen,
  ClipboardList,
  Users,
  Bookmark,
  Sun,
  ListChecks,
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
import { useAuth } from "@/components/providers/AuthContext"

type NavItem = { title: string; icon: typeof Sun; url: string }

// PROD-74: four primary destinations, then discovery, workspace and
// community. Every pre-existing URL still resolves; Profile, Settings and the
// widget dashboard live in the account menu.
const navGroups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { title: "Today", icon: Sun, url: "/today" },
      { title: "My shortlist", icon: ListChecks, url: "/shortlist" },
      { title: "My applications", icon: ClipboardList, url: "/applications" },
    ],
  },
  {
    label: "Explore",
    items: [
      { title: "Scholarships", icon: GraduationCap, url: "/scholarships" },
      { title: "Universities", icon: School, url: "/schools" },
      { title: "Courses", icon: BookOpen, url: "/majors" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Essays", icon: FileText, url: "/essays" },
      { title: "Documents", icon: FolderOpen, url: "/documents" },
      { title: "Resume builder", icon: FileUser, url: "/resume-builder" },
    ],
  },
  {
    label: "Community",
    items: [
      { title: "Community Campus", icon: Users, url: "/communities" },
      { title: "Saved posts", icon: Bookmark, url: "/communities/saved" },
    ],
  },
]

/** The single nav URL that best matches the path (longest segment prefix),
 *  so /communities/saved highlights only "Saved posts". */
export function activeNavUrl(pathname: string): string | null {
  let best: string | null = null
  for (const group of navGroups) {
    for (const { url } of group.items) {
      const matches = pathname === url || pathname.startsWith(`${url}/`)
      if (matches && (!best || url.length > best.length)) best = url
    }
  }
  return best
}

export function AppSidebar({
  initialAvatarUrl = null,
  ...props
}: React.ComponentProps<typeof Sidebar> & { initialAvatarUrl?: string | null }) {
  const pathname = usePathname()
  const active = activeNavUrl(pathname)
  // C5: read the already-resolved user from AuthContext instead of firing this
  // sidebar's own getUser() + profile fetch on every navigation. The avatar is
  // resolved once server-side and passed in.
  const { user: authUser } = useAuth()

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
        <Link href="/today" className="inline-flex items-center focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-sidebar-ring focus-visible:outline-offset-2">
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
        {navGroups.map((group, index) => (
          <SidebarGroup key={group.label ?? "primary"} className={index > 0 ? "mt-1" : undefined}>
            {group.label ? (
              <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = active === item.url
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="gap-3 px-4 py-2.5 rounded-none text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-[#9a1a27] data-[active=true]:text-white data-[active=true]:hover:bg-[#9a1a27] data-[active=true]:hover:text-white data-[active=true]:font-medium transition-colors duration-100"
                      >
                        <Link href={item.url} aria-current={isActive ? "page" : undefined}>
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {mounted && user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
