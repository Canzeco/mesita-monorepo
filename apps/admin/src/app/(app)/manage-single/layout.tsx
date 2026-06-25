import { PageContainer } from "@/components/PageContainer";
import { ManageSingleLayoutShell } from "./ManageSingleLayoutShell";

export default function ManageSingleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer className="pb-10 sm:pb-14">
      <ManageSingleLayoutShell>{children}</ManageSingleLayoutShell>
    </PageContainer>
  );
}
