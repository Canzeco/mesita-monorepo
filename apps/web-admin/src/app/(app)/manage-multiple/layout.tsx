import { PageContainer } from "@/components/PageContainer";
import { ManageMultipleLayoutShell } from "./ManageMultipleLayoutShell";

export default function ManageMultipleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <ManageMultipleLayoutShell>{children}</ManageMultipleLayoutShell>
    </PageContainer>
  );
}
