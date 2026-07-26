import { PageContainer } from "@/components/PageContainer";
import { AtlasLayoutShell } from "./AtlasLayoutShell";

// Atlas Config — tabbed (Config · Playground). The layout mounts the shared shell
// (header + tab strip); each subpage renders its own content beneath it. Atlas is
// the profile spec — the controlled vocabulary and field limits the Enricher and
// operators write place profiles with. The Enricher's own pipeline behaviour
// lives on the separate Enricher Config page.
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
