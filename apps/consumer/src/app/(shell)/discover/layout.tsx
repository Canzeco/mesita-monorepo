import { DiscoverFilterBar } from "@/components/consumer/DiscoverFilterBar";

// The top chrome row (rendered by TopBar via DiscoverHeader) now hosts the
// Swipe/Map/AI-Search tabs. The WHAT/WHERE/WHEN picker lives here as a
// discover-specific band directly beneath that row — outside the scroll
// container so its dropdowns overlay the surface without reflowing it.
export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DiscoverFilterBar />
      <div className="scrollbar-hide flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
