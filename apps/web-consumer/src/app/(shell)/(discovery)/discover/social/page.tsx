import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared";

// SOCIAL — Home's second pill (Pato, MESITA-2166). Nothing social exists yet:
// no follows, no posts, no shared lists. The page says so in words rather
// than painting sample people (no mock data in product surfaces). It is a
// flex column so EmptyState centres instead of hugging the top.
export default function DiscoverSocialPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmptyState
        icon={Users}
        title="Social is coming"
        description="See where your friends go and what they save. Not live yet."
      />
    </div>
  );
}
