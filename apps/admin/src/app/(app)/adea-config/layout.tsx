import { PageContainer } from "@/components/PageContainer";
import { AdeaLayoutShell } from "./AdeaLayoutShell";

export default function AdeaConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <AdeaLayoutShell>{children}</AdeaLayoutShell>
    </PageContainer>
  );
}
