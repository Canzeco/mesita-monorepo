import { Bot, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SocialTab } from '@/components/home/SocialTab';
import { AskAiTab } from '@/components/memo/AskAiTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';

type Mode = 'swipe' | 'ai' | 'social' | 'favorites';

const MODES: {
  key: Mode;
  title: string;
  Icon: ComponentType<{ color?: string; size?: number }>;
}[] = [
  { key: 'swipe', title: 'Swipe', Icon: Sparkles },
  { key: 'ai', title: 'Ask AI', Icon: Bot },
  { key: 'social', title: 'Social', Icon: Users },
  { key: 'favorites', title: 'Favorites', Icon: Heart },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('swipe');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
          <SegmentedButtons
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            density="small"
            buttons={MODES.map(({ key, title }) => ({
              value: key,
              label: title,
              style: { minWidth: 0 },
              labelStyle: { fontSize: 11 },
            }))}
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
