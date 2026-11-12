import { BrandHeader } from "@/components/consumer/ModeTabs";
import { RowFallback } from "@/components/consumer/home/DiscoverFallback";
import { Skeleton } from "@/components/shared";

// Home's loading frame: CatalogRails' bands, block for block — the white
// header, the white tab strip with its hairline (Places · Social), then
// Places' grey emoji rail beside its rows (MESITA-3781, the only Places since
// MESITA-3789). Drawn by every frame that can stand before Home lands (the
// discovery group, the shell, a full page load), so a tap on Home never
// shows a spinner first (MESITA-2840).
export function HomeLoadingFrame() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy>
      <p role="status" className="sr-only">
        Loading Home
      </p>
      <BrandHeader>
        <Skeleton className="ml-auto h-8 w-36 rounded-full" />
      </BrandHeader>
      <div className="border-border bg-card flex shrink-0 border-b">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 justify-center py-3">
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="bg-background w-12 shrink-0" />
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <RowFallback />
        </div>
      </div>
    </div>
  );
}
