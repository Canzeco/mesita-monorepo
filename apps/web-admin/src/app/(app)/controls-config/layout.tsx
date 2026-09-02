import { ConfigPageLayout } from "@/components/ConfigPageLayout";

// Controls — the Wallet's Credits policy. One flat page. A label never repeats
// its section heading.
export default function ControlsConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConfigPageLayout eyebrow="Product · Controls" title="Controls">
      {children}
    </ConfigPageLayout>
  );
}
