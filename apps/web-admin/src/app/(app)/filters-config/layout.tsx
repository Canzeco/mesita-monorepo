import { ConfigTabNav } from "@/components/ConfigTabNav";
import { PageContainer, PageHeader } from "@/components/PageContainer";
import { DISCOVERY_TABS } from "./nav";

// Discovery — two subpages under a frozen /filters-config prefix.
// Search Modes · Search Modules. A label never repeats the heading.
export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow="Product · Discovery" title="Discovery" />
      <ConfigTabNav ariaLabel="Discovery sections" subroutes={DISCOVERY_TABS} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
