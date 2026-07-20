import { BlurView } from 'expo-blur';
import { Flame, Heart, Sparkles, Users } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoritesTab } from '@/components/home/FavoritesTab';
import { SocialTab } from '@/components/home/SocialTab';
import { AskAiTab } from '@/components/memo/AskAiTab';
import { SwipeDeck } from '@/components/swipe/SwipeDeck';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { SegmentNav, type SegmentItem } from '@/components/ui/SegmentNav';
import {
  isHomeModeParked,
  PARKED,
  type ParkedHomeModeKey,
} from '@/lib/parked-flags';

// Mirrors web HomeModeNav: Swipe + Memo + Favorites live; Social parked.
// Unpark Social = flip PARKED.homeModes.social.soon (one-flag drill).
// All mode panels stay mounted (keep-alive) so Memo thread + Social sort
// survive mode switches without remount flicker.
type Mode = 'swipe' | 'ai' | 'social' | 'favorites';

const MODES: (SegmentItem & {
  key: Mode;
  Icon: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
})[] = [
  { key: 'swipe', title: 'Swipe', Icon: Flame },
  { key: 'ai', title: 'Memo', Icon: Sparkles },
  {
    key: 'social',
    title: 'Social',
    Icon: Users,
    soon: PARKED.homeModes.social.soon,
  },
  { key: 'favorites', title: 'Favorites', Icon: Heart },
];

const SOON_ICONS: Record<ParkedHomeModeKey, typeof Users> = {
  social: Users,
};

function KeepAlivePane({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <View
      collapsable={false}
      pointerEvents={active ? 'auto' : 'none'}
      style={{
        flex: 1,
        minHeight: 0,
        display: active ? 'flex' : 'none',
      }}
    >
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('swipe');
  const [soonMode, setSoonMode] = useState<ParkedHomeModeKey | null>(null);
  const soon = soonMode ? PARKED.homeModes[soonMode] : null;
  const SoonIcon = soonMode ? SOON_ICONS[soonMode] : undefined;

  return (
    <ShellWash>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View className="relative z-20 shrink-0 border-b border-border">
          {Platform.OS === 'web' ? (
            <View
              className="absolute inset-0 bg-background/90"
              pointerEvents="none"
            />
          ) : (
            <BlurView
              intensity={40}
              tint="light"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          )}
          <View
            className="absolute inset-0 bg-background/80"
            pointerEvents="none"
          />
          <View
            className="relative"
            style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10 }}
          >
            <SegmentNav
              items={MODES}
              value={mode}
              onChange={(v) => {
                if (isHomeModeParked(v)) {
                  setSoonMode(v);
                  return;
                }
                if (
                  v === 'swipe' ||
                  v === 'ai' ||
                  v === 'social' ||
                  v === 'favorites'
                ) {
                  setMode(v);
                }
              }}
            />
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 0 }}>
          <KeepAlivePane active={mode === 'swipe'}>
            <SwipeDeck />
          </KeepAlivePane>
          <KeepAlivePane active={mode === 'ai'}>
            <AskAiTab />
          </KeepAlivePane>
          <KeepAlivePane active={mode === 'social'}>
            <SocialTab />
          </KeepAlivePane>
          <KeepAlivePane active={mode === 'favorites'}>
            <FavoritesTab />
          </KeepAlivePane>
        </View>

        <ComingSoonModal
          open={soon != null}
          onClose={() => setSoonMode(null)}
          title={soon?.title ?? 'Coming soon'}
          body={soon?.body}
          icon={SoonIcon}
          variant="homeMode"
        />
      </SafeAreaView>
    </ShellWash>
  );
}
