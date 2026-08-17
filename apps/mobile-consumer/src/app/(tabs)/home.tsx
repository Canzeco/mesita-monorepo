import { Flame, Heart, LayoutGrid, Sparkles, Users } from 'lucide-react-native';
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

// Mirrors web HomeModeNav: only Swipe + Favorites are FUNCTIONAL (Pato,
// 2026-08-16); Catalog, Chat and Social are parked. Parked modes stay tappable
// and open a coming-soon modal (MESITA-601). CatalogTab / AskAiTab / SocialTab
// all stay on disk, so each is a one-flag unpark.
type Mode = 'swipe' | 'favorites';

const MODES: (SegmentItem & {
  key: Mode | SoonMode;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
})[] = [
  { key: 'swipe', title: 'Swipe', Icon: Flame },
  { key: 'catalog', title: 'Catalog', Icon: LayoutGrid, soon: true },
  // The pill reads "Memo" again (MESITA-1103). It was "Chat" so the label
  // would name what the mode DOES — sound until the mode grew a second way in.
  // Memo now offers Call AND Chat, so "Chat" names half of it.
  { key: 'ai', title: 'Memo', Icon: Sparkles, soon: true },
  { key: 'social', title: 'Social', Icon: Users, soon: true },
  { key: 'favorites', title: 'Favorites', Icon: Heart },
];

type SoonMode = 'catalog' | 'ai' | 'social';

const SOON_META = {
  catalog: {
    title: 'Catalog',
    body: 'The full Mesita catalog — every place, browsable and filterable, without swiping. Coming soon.',
    Icon: LayoutGrid,
  },
  ai: {
    title: 'Memo',
    body: "Don Memo, your AI concierge, is almost ready — call him or chat with him, tell him the vibe you want, and he'll find your spot.",
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
              if (v === 'catalog' || v === 'ai' || v === 'social')
                setSoonMode(v);
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
