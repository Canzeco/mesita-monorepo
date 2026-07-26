import { PageContainer } from "@/components/PageContainer";
import { SourcingLayoutShell } from "./SourcingLayoutShell";

// Sourcing Config — tabbed (Config · Playground). The layout mounts the shared
// shell (header + tab strip); each subpage renders its own content beneath it.
// Governs which Google Places are eligible to enter Mesita, per sourcing channel.
export default function SourcingConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <SourcingLayoutShell>{children}</SourcingLayoutShell>
    </PageContainer>
  );
}
