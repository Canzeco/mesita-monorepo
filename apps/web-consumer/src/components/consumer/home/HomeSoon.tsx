import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared";

// Social, Chat and Favs share Pay's Soon page (MESITA-2168). Places is the
// catalog and does not use this. A flex column so EmptyState centres; a
// block parent collapses it.
export function HomeSoon({
  icon,
  name,
  description,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmptyState
        icon={icon}
        title={`${name} is coming soon`}
        description={description}
      />
    </div>
  );
}
