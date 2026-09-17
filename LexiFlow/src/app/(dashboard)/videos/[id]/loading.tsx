export default function VideoStudyLoading() {
  return (
    <div className="grid flex-1 animate-pulse border-t border-border xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="p-5 lg:p-6">
        <div className="mx-auto aspect-video max-w-5xl rounded-2xl bg-muted" />
        <div className="mx-auto mt-4 h-44 max-w-5xl rounded-2xl bg-muted/70" />
      </div>
      <div className="hidden border-l border-border bg-card p-4 xl:block">
        <div className="h-9 rounded-lg bg-muted" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-muted/70" />
          ))}
        </div>
      </div>
    </div>
  )
}
