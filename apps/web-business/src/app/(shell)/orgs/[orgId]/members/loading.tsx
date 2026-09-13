// Members: a title, then rows of people.
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Loading members…</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-8 w-40 animate-pulse rounded" />
        <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
