import { EmptyState } from "@/components/empty-state";

/** The map, the bar and the results arrive with step 2 (MESITA-4934). */
export function SearchScreen({ onHome }: { onHome: () => void }) {
  return (
    <EmptyState
      message="Search is on its way. Places near you are on Home."
      action={{ label: "Go to Home", onPress: onHome }}
    />
  );
}
