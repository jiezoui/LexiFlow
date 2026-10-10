"use client"

import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { BadgeCheckIcon, LayoutDashboardIcon, LogOutIcon, SettingsIcon, SparklesIcon, UsersIcon } from "lucide-react"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
}) {
  const router = useRouter()
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="h-14 rounded-xl px-2 aria-expanded:bg-sidebar-accent cursor-pointer" />
            }
          >
            <Avatar>
              {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
              <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <SettingsIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback>{user.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer">
                <BadgeCheckIcon className="size-4 mr-2" />
                个人中心
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer">
                <SettingsIcon className="size-4 mr-2" />
                系统设置
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings?tab=ai")} className="cursor-pointer">
                <SparklesIcon className="size-4 mr-2" />
                模型设置
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard")} className="cursor-pointer">
                <LayoutDashboardIcon className="size-4 mr-2" />
                今日研习概览
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/sign-in")} className="cursor-pointer">
                <UsersIcon className="size-4 mr-2" />
                切换账号
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => router.push("/sign-in")}
                className="cursor-pointer"
              >
                <LogOutIcon className="size-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
