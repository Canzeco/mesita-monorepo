import { View } from 'react-native';

/**
 * Deck-shaped loading silhouette — mirrors SwipeDeck layout (card + five
 * action pills) so the deck arrives in place instead of a centered spinner.
 */
export function DeckSkeleton() {
  return (
    <View className="flex-1 px-3 pb-3 pt-2">
      <View className="min-h-0 w-full flex-1 rounded-3xl bg-muted" />
      <View className="mt-3 flex-row items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} className="h-12 flex-1 rounded-lg bg-muted" />
        ))}
      </View>
    </View>
  );
}
