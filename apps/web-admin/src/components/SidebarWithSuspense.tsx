import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";

// Fills whatever column the shell gives it, in the rail's own dark — a light
// placeholder would flash against the inverted menu it stands in for.
function SidebarFallback() {
  return <aside className="bg-foreground h-full w-full shrink-0" />;
}

export function SidebarWithSuspense({
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <Suspense fallback={<SidebarFallback />}>
      <Sidebar
        onNavigate={onNavigate}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
      />
    </Suspense>
  );
}
