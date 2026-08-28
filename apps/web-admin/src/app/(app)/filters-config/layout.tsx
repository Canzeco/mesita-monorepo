import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Discovery — two sections: Search Modes · Search Modules.
// Modes: Name (Fast) · Name (Deep) · Map · Swipe · Catalog · Chat ·
// Social · Favorites. Modules: General · Signals.
// Home boxes (Swipe · Catalog · Chat · Social · Favorites) are Soon.
// The route stays /filters-config: a rename stops at the label.
export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Product · Discovery" title="Discovery">
      {children}
    </ConfigPageLayout>
  );
}
