import { PageContainer } from "@/components/PageContainer";
import { AtlasLayoutShell } from "./AtlasLayoutShell";

export default function AtlasConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <AtlasLayoutShell>{children}</AtlasLayoutShell>
    </PageContainer>
  );
}
