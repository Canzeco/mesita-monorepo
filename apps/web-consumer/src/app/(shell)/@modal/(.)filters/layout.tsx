import { BottomSheetShell } from "@/components/consumer/overlay/BottomSheetShell";

// Soft-open /filters — BottomSheetShell mounts once for the intercepted
// segment so the enter animation plays across loading → page. DiscoveryFilters
// owns Filters / Reset / ✕ header and sticky CTA (hideHeader).
export default function FiltersModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BottomSheetShell hideHeader>{children}</BottomSheetShell>;
}
