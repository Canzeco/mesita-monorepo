import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Discovery — boxes General · Name · Map · Swipe · Catalog · Chat · Social · Favs.
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
