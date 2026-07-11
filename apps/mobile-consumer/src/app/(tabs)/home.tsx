import { Bot, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SocialTab } from '@/components/home/SocialTab';
import { AskAiTab } from '@/components/memo/AskAiTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';

// Home hub — Swipe · Ask AI · Social · Favorites (MESITA-431/432/433).
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
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center gap-1 px-3 pt-1 pb-2">
          {MODES.map(({ key, title, Icon }) => {
            const active = mode === key;
            return (
              <Pressable
                key={key}
                onPress={() => setMode(key)}
                className={`flex-1 flex-row items-center justify-center gap-1 rounded-full px-2 py-2 ${
                  active ? 'bg-primary/10' : 'bg-transparent'
                }`}
              >
                <Icon color={active ? '#fb2b7b' : '#775254'} size={14} />
                <Text
                  className={`text-[11px] font-medium ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="min-h-0 flex-1">
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
