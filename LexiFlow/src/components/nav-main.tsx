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
    <SidebarGroup>
      {label && (
        <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 font-mono">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url))
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={isActive}
                tooltip={item.title}
                render={<Link href={item.url} />}
                className="justify-between"
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span className="font-medium text-[13px]">{item.title}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="font-mono text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-full bg-accent">
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
