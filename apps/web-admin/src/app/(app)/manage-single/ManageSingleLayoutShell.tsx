"use client";

import { usePathname } from "next/navigation";
import { parsePlaceId } from "./nav";

export function ManageSingleLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const placeId = parsePlaceId(pathname);

  // Per-place editor: full-bleed main column so PlaceEditChrome spans
  // sidebar-edge → window-edge (no PageContainer max-w-6xl gutters).
  if (placeId) {
    return <div className="w-full">{children}</div>;
  }

  // Select / create / add hubs own their chrome — full-bleed like the
  // per-place editor. Every manage-single route hits one of these two
  // branches; there is no leftover PageHeader path (E-R9).
  return <div className="w-full pb-10 sm:pb-14">{children}</div>;
}
