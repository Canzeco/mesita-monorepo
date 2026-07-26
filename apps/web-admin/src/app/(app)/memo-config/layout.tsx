import { PageContainer } from "@/components/PageContainer";
import { MemoLayoutShell } from "./MemoLayoutShell";

// Memo Config — tabbed (Config · Playground). The layout mounts the shared shell
// (header + tab strip); each subpage renders its own content beneath it. Memo is
// Mesita's consumer AI concierge (consumer-web-ask-memo); it lived as a Scoring
// tab for a while (PR #176), pulled back out as its own section by MESITA-627.
export default function MemoConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <MemoLayoutShell>{children}</MemoLayoutShell>
    </PageContainer>
  );
}
