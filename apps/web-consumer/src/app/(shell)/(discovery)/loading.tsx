"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { BrandHeader } from "@/components/consumer/ModeTabs";
import { DiscoverFallback } from "@/components/consumer/home/DiscoverFallback";
import { Skeleton } from "@/components/shared";
import SearchLoading from "./search/loading";

// THE FRAME A SEARCH ↔ HOME SWITCH PAINTS AT ONCE (MESITA-2824). This
// boundary wraps whichever sibling the tap goes to, so the old screen never
// stays up while the server answers: every segment under (shell) is dynamic,
// so Next has nothing prefetched to paint, and the bar's tap read as dead
// (Pato: "even when i wait home is not working"). It draws the TARGET
// screen's silhouette, never a shared spinner (Pato, MESITA-2701: "the
// placeholders must be similar to the page you are loading"): the segment
// being loaded is known here, before its layout arrives. Home's frame is
// CatalogRails' bands, block for block: the white header, the white tab
// strip with its hairline, the grey family column a quarter wide, then the
// tile column.
export default function DiscoveryLoading() {
  const segment = useSelectedLayoutSegment();
  if (segment === "search") return <SearchLoading />;
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy>
      <p role="status" className="sr-only">
        Loading Home
      </p>
      <BrandHeader>
        <Skeleton className="ml-auto h-8 w-36 rounded-full" />
      </BrandHeader>
      <div className="border-border bg-card flex shrink-0 border-b">
        <div className="flex flex-1 justify-center py-3">
          <Skeleton className="h-5 w-14" />
        </div>
        <div className="flex flex-1 justify-center py-3">
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="bg-border w-1/4 shrink-0" />
        <div className="bg-card flex min-h-0 flex-1 flex-col overflow-hidden">
          <DiscoverFallback />
        </div>
      </div>
    </div>
  );
}
