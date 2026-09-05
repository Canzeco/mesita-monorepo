// Place detail chrome: name header comes from each tab page (layouts can't
// read searchParams); this layout only renders the tab row.
import { Suspense } from "react";
import { PlaceTabs } from "@/components/console/PlaceTabs";

export default function PlaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-10" />}>
        <PlaceTabs />
      </Suspense>
      {children}
    </div>
  );
}
