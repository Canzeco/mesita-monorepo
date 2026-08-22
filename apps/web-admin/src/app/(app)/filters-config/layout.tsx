import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Discovery — ONE flat page. Signals and Engines were separate tabs; they are
// joined (Pato, 2026-08-22). The route stays /filters-config: a rename stops
// at the label.
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
