import { DiscoverHeader } from "@/components/consumer/DiscoverHeader";
import { DiscoverTabs } from "@/components/consumer/DiscoverTabs";

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DiscoverHeader />
      <DiscoverTabs />
      <div className="scrollbar-hide flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
