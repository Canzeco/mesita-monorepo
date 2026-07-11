import { PageContainer } from "@/components/PageContainer";
import { EnricherLayoutShell } from "./EnricherLayoutShell";

export default function EnricherConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <EnricherLayoutShell>{children}</EnricherLayoutShell>
    </PageContainer>
  );
}
