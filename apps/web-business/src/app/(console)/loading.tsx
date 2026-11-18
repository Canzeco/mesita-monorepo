// Every console page while its server data answers (MESITA-4378): a title
// bone over cards of rows, as the pages draw them. Pages with their own
// loading.tsx keep theirs.
export default function ConsoleLoading() {
  return (
    <div className="flex flex-col gap-4 pb-8" aria-busy="true" aria-label="Loading">
      <div className="bg-muted h-7 w-48 animate-pulse rounded-lg" />
      {[3, 2].map((rows, n) => (
        <div key={n} className="border-border bg-card divide-border divide-y rounded-2xl border">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="bg-muted size-10 animate-pulse rounded-xl" />
              <div className="bg-muted h-4 flex-1 animate-pulse rounded" />
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
