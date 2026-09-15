"use client"

import { useParams } from "next/navigation"
import { WordbookStudyWorkspace } from "@/components/wordbook/wordbook-study-workspace"

export default function WordbookStandalonePage() {
  const params = useParams()
  const bookId = Number(params?.id || 1)

  return <WordbookStudyWorkspace bookId={bookId} />
}
