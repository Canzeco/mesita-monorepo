import { formatAbsoluteUtc } from "@/lib/format";

export function ActivityFeedList({
  items,
  emptyLabel = "No recent activity in this window.",
}: {
  items: Array<{ id: string; at: string; line: string }>;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground px-4 py-8 text-sm">{emptyLabel}</p>;
  }
  return (
    <ol className="max-h-[50vh] overflow-y-auto">
      {items.map((item) => (
        <li
          key={item.id}
          className="border-border/60 grid gap-2 border-b px-4 py-2.5 last:border-b-0 sm:grid-cols-[9.5rem_1fr] sm:items-start sm:gap-3"
        >
          <time className="text-muted-foreground font-mono type-meta" dateTime={item.at}>
            {formatAbsoluteUtc(item.at)}
          </time>
          <p className="font-mono text-xs leading-relaxed break-all">{item.line}</p>
        </li>
      ))}
    </ol>
  );
}
