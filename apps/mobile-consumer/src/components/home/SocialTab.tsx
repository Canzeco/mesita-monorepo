import { Image } from 'expo-image';
import { Crown, RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { SocialProfileSheet } from '@/components/home/SocialProfileSheet';
import { useHomeDeck } from '@/hooks/use-home-deck';
import {
  SOCIAL_ACTION_META,
  SOCIAL_PEOPLE,
  socialRelevance,
  type SocialPerson,
} from '@/lib/social-feed-data';

type SocialSort = 'recent' | 'relevance';
const SORT_MODES: { key: SocialSort; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'recent', label: 'Recent' },
];

type Jitter = { recent: number; relevance: number };
function makeJitter(): Map<string, Jitter> {
  return new Map(
    SOCIAL_PEOPLE.map((p) => [
      p.id,
      { recent: Math.random() * 20, relevance: Math.random() * 10 },
    ]),
  );
}

export function SocialTab() {
  const deckQuery = useHomeDeck();
  const places = deckQuery.data ?? [];
  const [profile, setProfile] = useState<SocialPerson | null>(null);
  const [sort, setSort] = useState<SocialSort>('relevance');
  const [jitter, setJitter] = useState<Map<string, Jitter>>(makeJitter);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setJitter(makeJitter());
    setTimeout(() => setRefreshing(false), 500);
  };

  const people = useMemo(() => {
    const scored = SOCIAL_PEOPLE.map((p) => {
      const j = jitter.get(p.id);
      return {
        p,
        recent: p.minutesAgo + (j?.recent ?? 0),
        relevance: socialRelevance(p) + (j?.relevance ?? 0),
      };
    });
    scored.sort((a, b) =>
      sort === 'recent' ? a.recent - b.recent : b.relevance - a.relevance,
    );
    return scored.map((s) => s.p);
  }, [sort, jitter]);

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4 pb-6">
        <View className="mb-3 flex-row items-center justify-between px-1">
          <Text className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Activity
          </Text>
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-1.5 rounded-full bg-primary/10 px-2 py-1">
              <View className="size-1.5 rounded-full bg-primary" />
              <Text className="text-[10px] font-semibold text-primary">Live</Text>
            </View>
            <Pressable
              onPress={refresh}
              disabled={refreshing}
              accessibilityLabel="Refresh activity"
              className="h-7 flex-row items-center gap-1.5 rounded-full border border-border bg-card px-2.5 disabled:opacity-60"
            >
              <RefreshCw color="#775254" size={12} />
              <Text className="text-[11px] font-semibold text-muted-foreground">
                Refresh
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mb-3 flex-row gap-1 rounded-xl bg-muted/60 p-1">
          {SORT_MODES.map((mode) => {
            const active = sort === mode.key;
            return (
              <Pressable
                key={mode.key}
                onPress={() => setSort(mode.key)}
                className={`flex-1 rounded-lg py-1.5 ${active ? 'bg-card' : ''}`}
              >
                <Text
                  className={`text-center text-xs font-semibold ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="gap-2">
          {people.map((p) => {
            const place =
              places.length > 0 ? places[p.placeSlot % places.length] : null;
            const meta = SOCIAL_ACTION_META[p.action];
            const ActionIcon = meta.Icon;
            return (
              <View
                key={p.id}
                className="flex-row items-center gap-2 rounded-2xl border border-border bg-card p-2.5"
              >
                <Pressable
                  onPress={() => setProfile(p)}
                  className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
                >
                  <View className="relative">
                    <Image
                      source={{ uri: p.avatarUrl }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                      contentFit="cover"
                    />
                    {p.plan === 'premium' ? (
                      <View className="absolute -top-0.5 -right-0.5 size-4 items-center justify-center rounded-full bg-amber-400">
                        <Crown color="#fff" size={9} fill="#fff" />
                      </View>
                    ) : null}
                  </View>
                  <View className="min-w-0 flex-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text
                        className="text-sm font-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <View
                        className={`flex-row items-center gap-1 rounded-md px-1.5 py-0.5 ${meta.bg}`}
                      >
                        <ActionIcon color={meta.color} size={10} />
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-[11px] text-muted-foreground">
                      {p.igHandle} · {p.time}
                    </Text>
                  </View>
                </Pressable>

                <View className="max-w-[36%] rounded-xl border border-border bg-muted/40 px-2 py-1.5">
                  <Text
                    className="text-[11px] font-semibold text-foreground"
                    numberOfLines={2}
                  >
                    {place?.name ?? p.fallbackPlaceName}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <SocialProfileSheet
        profile={profile}
        onClose={() => setProfile(null)}
      />
    </View>
  );
}
