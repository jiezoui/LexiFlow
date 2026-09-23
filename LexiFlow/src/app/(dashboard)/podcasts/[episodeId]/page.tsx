import { PodcastStudyEntry } from "@/components/podcast/podcast-study-entry"

export default async function PodcastStudyPage({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] min-w-0 flex-col lg:h-[calc(100dvh-5rem)] lg:min-h-0 lg:shrink-0 lg:overflow-hidden">
      <PodcastStudyEntry episodeId={episodeId} />
    </div>
  )
}
