"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const labelMap: Record<string, string> = {
  dashboard: "今日概览",
  wordbooks: "词书库",
  vocab: "生词本",
  videos: "视频精听",
  reading: "阅读库",
  settings: "系统设置",
  notifications: "消息通知",
  support: "帮助与反馈",
}

export function DynamicBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/")
          const label =
            index > 0 && segments[0] === "videos"
              ? "精听工作台"
              : labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
          const isLast = index === segments.length - 1

          return (
            <Fragment key={href}>
              <BreadcrumbItem className={index === 0 && segments.length > 1 ? "hidden md:block" : undefined}>
                {isLast ? (
                  <BreadcrumbPage className="font-semibold text-foreground">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={href} />} className="text-muted-foreground hover:text-primary">
                    {label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
