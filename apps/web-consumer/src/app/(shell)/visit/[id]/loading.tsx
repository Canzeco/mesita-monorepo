import { Skeleton } from "@/components/shared";

// First-frame silhouette of THE TICKET (MESITA-1029 S2): chrome row → rail →
// pass block → CTA-ish bar, mirroring TicketScreen's Shell paddings so the
// resolve is a content swap, not a layout jump. Only hard loads and deep
// links ever see it — the in-app tap path arrives seeded and paints content
// on the first frame.
export default function TicketLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pt-3 pb-3">
      <div className="flex shrink-0 items-center gap-2.5 px-0.5 py-1">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="size-9 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="border-border shrink-0 border-b pt-1 pb-2.5">
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <Skeleton className="rounded-panel mt-3 h-72 shrink-0" />
      <Skeleton className="mt-2.5 h-12 shrink-0 rounded-2xl" />
    </div>
  );
}
