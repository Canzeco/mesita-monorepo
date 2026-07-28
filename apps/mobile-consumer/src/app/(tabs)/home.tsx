import { Flame, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { subscribeHomeMode } from '@/components/swipe/home-mode-intent';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';

// Mirrors web HomeModeNav: Swipe + Favorites live; Memo + Social parked.
// Parked modes stay tappable and open a coming-soon modal (MESITA-601).
// AskAiTab / SocialTab stay on disk for a one-flag unpark.
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

type SoonMode = 'ai' | 'social';

const SOON_META = {
  ai: {
    title: 'Memo',
    body: "Don Memo, your AI concierge, is almost ready — tell him the vibe you want and he'll find your spot.",
    Icon: Sparkles,
  },
  social: {
    title: 'Social',
    body: 'See where your friends are going and share the places you love. Landing here soon.',
    Icon: Users,
  },
} satisfies Record<
  SoonMode,
  { title: string; body: string; Icon: typeof Sparkles }
>;

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('swipe');
  const [soonMode, setSoonMode] = useState<SoonMode | null>(null);
  const soon = soonMode ? SOON_META[soonMode] : null;

  // A Swipe "Saved · View" toast requests the Favorites segment (the deck lives
  // outside this screen and can't flip the parent segment directly).
  useEffect(() => subscribeHomeMode((m) => setMode(m)), []);

  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          className="border-b border-border bg-background/90"
          style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 }}
        >
          <SegmentNav
            items={MODES}
            value={mode}
            onChange={(v) => {
              if (v === 'swipe' || v === 'favorites') {
                setMode(v);
                return;
              }
              if (v === 'ai' || v === 'social') setSoonMode(v);
            }}
          />
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          {mode === 'swipe' ? <SwipeDeck /> : <FavoritesTab />}
        </View>

        <ComingSoonModal
          open={soon != null}
          onClose={() => setSoonMode(null)}
          title={soon?.title ?? 'Coming soon'}
          body={soon?.body}
          icon={soon?.Icon}
        />
      </SafeAreaView>
    </ShellWash>
  );
}
