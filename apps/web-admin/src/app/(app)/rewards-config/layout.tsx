import { PageContainer } from "@/components/PageContainer";
import { PromosLayoutShell } from "./PromosLayoutShell";

// Promos Config — tabbed (Config · Playground). The layout mounts the shared
// shell (header + tab strip); each subpage renders its own content beneath it.
// v10 (MESITA-991): the additive base + bonuses model replaces the 40-cell
// best-of matrix; the URL stays /rewards-config (copy-only rename, D4-A).
export default function PromosConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PromosLayoutShell>{children}</PromosLayoutShell>
    </PageContainer>
  );
}
