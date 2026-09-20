import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Crenup — one flat page, five modules, same kit as Discovery (no page
// blurb). /sourcing-config redirects to Discovery; /verification-config
// redirects here. A label never repeats its heading.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Operations · Crenup" title="Crenup">
      {children}
    </ConfigPageLayout>
  );
}
