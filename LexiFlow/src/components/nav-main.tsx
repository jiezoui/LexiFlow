"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export interface NavMainItem {
  title: string
  url: string
  icon: React.ReactNode
  badge?: string | number
}

export function NavMain({
  items,
  label,
}: {
  label?: string
  items: NavMainItem[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup className="p-0">
      {label && (
        <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 font-mono">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu className="gap-1">
        {items.map((item) => {
          const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(`${item.url}/`))
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                render={<Link href={item.url} />}
                className="h-11 justify-between rounded-xl px-3 text-sidebar-foreground transition-colors duration-200 hover:bg-sidebar-accent focus-visible:ring-2 active:scale-[0.99] data-active:bg-sidebar-accent data-active:font-semibold"
              >
                <div className="flex min-w-0 items-center gap-3.5 [&_svg]:size-[18px]">
                  {item.icon}
                  <span className="truncate text-sm tracking-wide">{item.title}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-semibold tabular-nums text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                    {item.badge}
                  </span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
