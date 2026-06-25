import { ManageMultipleTabs } from "./TabNav";
import { PageContainer, PageHeader } from "@/components/PageContainer";

// "Manage Multiple Units" — the three bulk tools are addressable sub-routes
// (/manage-multiple/{search,create,update}). This layout owns the shared
// header + tab nav; each sub-route renders its tool body into {children}.
export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <PageHeader eyebrow="Units · Multiple" title="Manage Multiple Units" />
      <ManageMultipleTabs />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
