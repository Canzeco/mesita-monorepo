import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Discovery — boxes General · Name (Fast Search) · Name (Deep Search) ·
// Map · Swipe · Catalog · Chat · Social · Favorites · Signals.
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
