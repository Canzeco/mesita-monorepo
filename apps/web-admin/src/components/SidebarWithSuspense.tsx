import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

function SidebarFallback() {
  return (
    <aside className="border-border bg-card flex h-full w-56 shrink-0 flex-col border-r px-2.5 pt-5 pb-4 lg:w-64 lg:px-3" />
  );
}

export function SidebarWithSuspense({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <Sidebar onNavigate={onNavigate} />
    </Suspense>
  );
}
