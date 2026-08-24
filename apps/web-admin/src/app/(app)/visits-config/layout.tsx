import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Visits — the local context's policy. One flat page. A label never repeats
// its section heading.
export default function VisitsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Product · Visits" title="Visits">
      {children}
    </ConfigPageLayout>
  );
}
