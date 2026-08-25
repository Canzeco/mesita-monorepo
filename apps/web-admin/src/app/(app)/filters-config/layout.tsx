import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Discovery — ONE flat page, TWO boxes: Signals · Engines. The route stays
// /filters-config: a rename stops at the label.
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
