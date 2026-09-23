"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { usePathname } from "next/navigation"

interface BreadcrumbTitle {
  pathname: string
  title: string
}

interface BreadcrumbTitleContextValue {
  currentTitle: BreadcrumbTitle | null
  setTitle: Dispatch<SetStateAction<BreadcrumbTitle | null>>
}

const BreadcrumbTitleContext = createContext<BreadcrumbTitleContextValue | null>(null)

export function BreadcrumbTitleProvider({ children }: { children: ReactNode }) {
  const [currentTitle, setCurrentTitle] = useState<BreadcrumbTitle | null>(null)
  const value = useMemo(
    () => ({ currentTitle, setTitle: setCurrentTitle }),
    [currentTitle]
  )

  return (
    <BreadcrumbTitleContext.Provider value={value}>
      {children}
    </BreadcrumbTitleContext.Provider>
  )
}

export function useCurrentBreadcrumbTitle(pathname: string) {
  const context = useContext(BreadcrumbTitleContext)
  if (!context || context.currentTitle?.pathname !== pathname) return null
  return context.currentTitle.title
}

export function usePrimeBreadcrumbTitle() {
  const context = useContext(BreadcrumbTitleContext)
  const setTitle = context?.setTitle

  return useCallback(
    (pathname: string, title: string) => {
      const normalizedTitle = title.trim()
      if (!setTitle || !normalizedTitle) return
      setTitle({ pathname, title: normalizedTitle })
    },
    [setTitle]
  )
}

export function useBreadcrumbTitle(title?: string) {
  const pathname = usePathname()
  const context = useContext(BreadcrumbTitleContext)
  const setTitle = context?.setTitle
  const normalizedTitle = title?.trim()

  const clearCurrentTitle = useCallback(() => {
    setTitle?.((current) =>
      current?.pathname === pathname && current.title === normalizedTitle ? null : current
    )
  }, [normalizedTitle, pathname, setTitle])

  useEffect(() => {
    if (!normalizedTitle || !setTitle) return

    setTitle({ pathname, title: normalizedTitle })
    return clearCurrentTitle
  }, [clearCurrentTitle, normalizedTitle, pathname, setTitle])
}
