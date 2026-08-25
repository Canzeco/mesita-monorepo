import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Intake — one flat page, five modules, same kit as Discovery (no page
// blurb). /sourcing-config redirects here. A label never repeats its heading.
export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Operations · Intake" title="Intake">
      {children}
    </ConfigPageLayout>
  );
}
