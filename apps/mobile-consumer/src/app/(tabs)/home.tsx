import { Flame, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SocialTab } from '@/components/home/SocialTab';
import { AskAiTab } from '@/components/memo/AskAiTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { SegmentNav } from '@/components/ui/SegmentNav';

type Mode = 'swipe' | 'ai' | 'social' | 'favorites';

// Icons + labels mirror web-consumer's HomeModeNav (Swipe·Memo·Social·Favorites).
// Memo/Social are parked "soon" on web but ship live here — keep them live.
const MODES: {
  key: Mode;
  title: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
}[] = [
  { key: 'swipe', title: 'Swipe', Icon: Flame },
  { key: 'ai', title: 'Memo', Icon: Sparkles },
  { key: 'social', title: 'Social', Icon: Users },
  { key: 'favorites', title: 'Favorites', Icon: Heart },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('swipe');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}>
          <SegmentNav
            items={MODES}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {mode === 'swipe' ? (
            <SwipeDeck />
          ) : mode === 'ai' ? (
            <AskAiTab />
          ) : mode === 'social' ? (
            <SocialTab />
          ) : (
            <FavoritesTab />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
