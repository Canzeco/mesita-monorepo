import { DiscoverTabs } from "@/components/consumer/DiscoverTabs";

// DiscoverHeader moved up to the shell layout (rendered by TopBar) so
// the header sits structurally outside any scroll container — same
// pattern as the other top-level surfaces. DiscoverTabs stays here
// because it's a discover-specific sub-band beneath the header.
export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DiscoverTabs />
      <div className="scrollbar-hide flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
