import { MediaStudyWorkspace } from "@/components/video/media-study-workspace"

export default async function VideoStudyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 shrink-0 flex-col overflow-hidden md:h-[calc(100dvh-5rem)]">
      <MediaStudyWorkspace mediaId={id} />
    </div>
  )
}
