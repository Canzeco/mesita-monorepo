import { BrandHeader } from "@/components/consumer/ModeTabs";
import { RowFallback } from "@/components/consumer/home/DiscoverFallback";
import { Skeleton } from "@/components/shared";

// Home's loading frame: CatalogRails' bands, block for block — one black
// band (MESITA-4442): the header, the tab strip with its hairline (Places · Social), then
// Places' family row (Uber Eats' emoji over name) over full-width rows (MESITA-4410; a grey
// emoji rail beside them since MESITA-3781 before). Drawn by every frame that can stand before Home lands (the
// discovery group, the shell, a full page load), so a tap on Home never
// shows a spinner first (MESITA-2840).
export function HomeLoadingFrame() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy>
      <p role="status" className="sr-only">
        Loading Home
      </p>
      <BrandHeader>
        <Skeleton className="bg-paper/10 ml-auto h-9 w-36 rounded-xl" />
      </BrandHeader>
      <div className="border-paper/10 bg-foreground flex shrink-0 border-b">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 justify-center py-3">
            <Skeleton className="bg-paper/10 h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="bg-foreground border-paper/10 flex shrink-0 flex-col overflow-hidden border-b pt-2.5 pb-1.5">
        <div className="flex gap-0.5 px-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 pb-1">
              <Skeleton className="bg-paper/10 h-10 w-10 rounded-full" />
              <Skeleton className="bg-paper/10 h-2.5 w-8" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
        <RowFallback />
      </div>
    </div>
  );
}
