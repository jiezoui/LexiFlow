import { AppSidebar } from "@/components/app-sidebar"
import { AiConfigBootstrap } from "@/components/ai-config-bootstrap"
import { CommandPalette } from "@/components/command-palette"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb"
import { BreadcrumbTitleProvider } from "@/components/breadcrumb-title-context"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="h-svh max-h-svh overflow-hidden flex flex-col md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:h-[calc(100svh-1rem)] md:peer-data-[variant=inset]:max-h-[calc(100svh-1rem)]">
        <BreadcrumbTitleProvider>
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <DynamicBreadcrumb />
            </div>
            <div className="ml-auto flex items-center gap-2 pr-4">
              <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
              <ThemeToggle />
            </div>
          </header>
          <CommandPalette />
          <AiConfigBootstrap />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </BreadcrumbTitleProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
