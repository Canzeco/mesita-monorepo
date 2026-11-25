import { EmptyState } from "@/components/empty-state";

/** The map, the bar and the rail arrive with step 2 (MESITA-4934). */
export function SearchScreen({ onHome }: { onHome: () => void }) {
  return (
    <EmptyState
      icon="search"
      title="Search is on its way"
      message="Places near you are on Home."
      action={{ label: "Go to Home", onPress: onHome }}
    />
  );
}
