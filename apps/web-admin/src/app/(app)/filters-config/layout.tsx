import { PageContainer } from "@/components/PageContainer";
import { DiscoveryChrome } from "./DiscoveryChrome";

// Discovery — two subpages under a frozen /filters-config prefix.
// Discovery Modes · Search Sources.
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
