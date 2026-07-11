import { Skeleton } from "@/components/shared/Skeleton";
import { SlideOverHeader } from "@/components/consumer/overlay/SlideOverShell";

// Skeleton bodies for the detail modals' loading.tsx files. These render
// INSIDE the shell mounted by the segment's layout.tsx (SlideOverShell /
// BottomSheetShell), so the panel slides in once and the skeleton resolves
// to content in place — never a separate spinner screen. Silhouettes mirror
// the real bodies closely so content arrival doesn't jump the layout.

// PlaceDetailBody silhouette: full-bleed square media hero (-mx-4, no top
// padding), then the summary header rows and section boxes in a gap-3 column.
export function PlaceBodySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 px-4 pb-4">
      <Skeleton className="-mx-4 aspect-square rounded-none" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

// Generic detail silhouette (coupon / reservation): inset rounded hero card,
// chip row, text rows, section boxes.
export function DetailBodySkeleton() {
  return (
    <div aria-hidden className="space-y-4 p-4">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

// Full slide-over loading states: real header chrome (title still resolving,
// back button already works — a slow fetch can be cancelled) over the body
// skeleton.
export function PlaceSlideOverSkeleton() {
  return (
    <>
      <SlideOverHeader title={<Skeleton className="mx-auto h-4 w-32" />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlaceBodySkeleton />
      </div>
    </>
  );
}

export function SlideOverLoadingSkeleton() {
  return (
    <>
      <SlideOverHeader title={<Skeleton className="mx-auto h-4 w-32" />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <DetailBodySkeleton />
      </div>
    </>
  );
}
