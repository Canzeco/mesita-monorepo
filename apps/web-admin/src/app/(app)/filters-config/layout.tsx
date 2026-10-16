import { PageContainer } from "@/components/PageContainer";
import { DiscoveryChrome } from "./DiscoveryChrome";

// Discovery — four subpages under a frozen /filters-config prefix.
// Sources · Modes · Signals · Matrix. Catalog is a mode.
export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer>
      <DiscoveryChrome />
      <div className="mt-6 sm:mt-8">{children}</div>
    </PageContainer>
  );
}
