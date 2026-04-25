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
  Hash,
  Plus,
} from "lucide-react"
import { fetchMyGroupsAction } from "@/app/(main)/communities/actions"
import type { CommunityGroup } from "@/types/community"

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
  { title: "Communities", icon: Users, url: "/communities" },
  { title: "Saved Posts",  icon: Bookmark, url: "/communities/saved" },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const [user, setUser] = React.useState<{ name: string; email: string; avatar: string } | null>(null)
  const [myGroups, setMyGroups] = React.useState<Pick<CommunityGroup, "id" | "slug" | "name">[]>([])

  React.useEffect(() => {
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const name =
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.email?.split("@")[0] ||
          "User"
        const { data: profileData } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", authUser.id)
          .single()
        setUser({
          name,
          email: authUser.email ?? "",
          avatar: profileData?.avatar_url ?? authUser.user_metadata?.avatar_url ?? "",
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
        supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", authUser.id)
          .single()
          .then(({ data: profileData }) => {
            setUser({
              name,
              email: authUser.email ?? "",
              avatar: profileData?.avatar_url ?? authUser.user_metadata?.avatar_url ?? "",
            })
          })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  React.useEffect(() => {
    fetchMyGroupsAction().then(({ groups }) => setMyGroups(groups))
  }, [])

  return (
    <Sidebar {...props}>
      <SidebarHeader className="py-5 px-6 border-b border-[#E5E5E5]">
        <Link href="/dashboard" className="inline-flex items-center focus-visible:outline focus-visible:outline-[2px] focus-visible:outline-black focus-visible:outline-offset-2">
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
          <SidebarGroupLabel className="text-[#525252] uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1">
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
                      className="gap-3 px-4 py-2.5 rounded-none text-[#525252] hover:text-black hover:bg-[#F5F5F5] data-[active=true]:bg-black data-[active=true]:text-white data-[active=true]:font-medium transition-colors duration-100"
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
          <SidebarGroupLabel className="text-[#525252] uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1">
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
                      className="gap-3 px-4 py-2.5 rounded-none text-[#525252] hover:text-black hover:bg-[#F5F5F5] data-[active=true]:bg-black data-[active=true]:text-white data-[active=true]:font-medium transition-colors duration-100"
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
          <SidebarGroupLabel className="text-[#525252] uppercase text-[10px] tracking-[0.15em] font-code px-4 mb-1 flex items-center justify-between">
            <span>My Communities</span>
            <Link href="/communities/groups" className="hover:text-black transition-colors">
              <Plus className="size-3" />
            </Link>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {myGroups.length === 0 ? (
                <SidebarMenuItem>
                  <Link
                    href="/communities/groups"
                    className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:text-black transition-colors"
                  >
                    Browse communities
                  </Link>
                </SidebarMenuItem>
              ) : (
                myGroups.map((group) => {
                  const isActive = pathname === `/communities/c/${group.slug}`
                  return (
                    <SidebarMenuItem key={group.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="gap-3 px-4 py-2.5 rounded-none text-[#525252] hover:text-black hover:bg-[#F5F5F5] data-[active=true]:bg-black data-[active=true]:text-white data-[active=true]:font-medium transition-colors duration-100"
                      >
                        <Link href={`/communities/c/${group.slug}`}>
                          <Hash className="size-4 shrink-0" strokeWidth={1.5} />
                          <span className="text-sm truncate">{group.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-[#E5E5E5]">
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
