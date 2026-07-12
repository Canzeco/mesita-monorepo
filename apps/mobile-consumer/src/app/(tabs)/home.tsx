import { Flame, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';

// Mirrors web HomeModeNav: Swipe + Favorites live; Memo + Social parked
// (soon: true) — visible but blocked until web un-parks (MESITA-383 / MESITA-565).
// AskAiTab / SocialTab stay in tree for a one-flag unpark.
type Mode = 'swipe' | 'favorites';

const MODES: (SegmentItem & {
  key: Mode | 'ai' | 'social';
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
})[] = [
  { key: 'swipe', title: 'Swipe', Icon: Flame },
  { key: 'ai', title: 'Memo', Icon: Sparkles, soon: true },
  { key: 'social', title: 'Social', Icon: Users, soon: true },
  { key: 'favorites', title: 'Favorites', Icon: Heart },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('swipe');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          className="border-b border-border bg-background/90"
          style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}
        >
          <SegmentNav
            items={MODES}
            value={mode}
            onChange={(v) => {
              if (v === 'swipe' || v === 'favorites') setMode(v);
            }}
          />
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {mode === 'swipe' ? <SwipeDeck /> : <FavoritesTab />}
        </View>
      </SafeAreaView>
    </View>
  );
}
