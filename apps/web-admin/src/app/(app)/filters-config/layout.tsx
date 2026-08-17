import { PageContainer } from "@/components/PageContainer";
import { FiltersLayoutShell } from "./FiltersLayoutShell";

// Filters Config — tabbed (General + one tab per consumer surface). The layout
// mounts the shared shell (header + tab strip); each subpage renders its own
// body beneath it.
export default function FiltersConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <FiltersLayoutShell>{children}</FiltersLayoutShell>
    </PageContainer>
  );
}
