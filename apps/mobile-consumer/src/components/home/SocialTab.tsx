import { RefreshCw } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ConsumerActivityList } from '@/components/inbox/ConsumerActivityList';
import { SocialActivityRow } from '@/components/home/social-activity-row';
import { SocialProfileSheet } from '@/components/home/SocialProfileSheet';
import { GLOBAL_ACTIVITY } from '@/lib/consumer-activity-data';
import { useHomeDeck } from '@/hooks/use-home-deck';
import {
  SOCIAL_PEOPLE,
  socialRelevance,
  type SocialPerson,
} from '@/lib/social-feed-data';

// Social mode — live activity feed (mock people + real deck places).
// Kept mounted from Home keep-alive; unpark = flip PARKED.homeModes.social.soon.
//
// GLOBAL ACTIVITY LIVES HERE NOW (Pato, 2026-08-17), web parity. It used to be
// a toggle inside Inbox > Notifications, which was the wrong home twice over:
// it isn't a notification (nothing happened to YOU), and it is exactly what
// Social is for. Notifications kept only your own activity.
//
// TODO(EF): social feed — people + events are mock (see social-feed-data.ts).
// When live, apply MESITA-913 privacy (anonymous private accounts; hide
// stories when privacy_show_stories=false).

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
                accessibilityState={{ selected: active }}
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
            return (
              <SocialActivityRow
                key={p.id}
                person={p}
                place={place ?? null}
                onPersonClick={setProfile}
              />
            );
          })}
        </View>

        {/* Global activity — the beat of Mesita generally, as opposed to the
            people rows above. Anonymised: other guests' moves, named by what
            happened, never by who. */}
        {GLOBAL_ACTIVITY.length > 0 ? (
          <>
            <View className="mt-6 mb-3 flex-row items-center gap-3 px-1">
              <Text className="text-[11px] font-semibold uppercase tracking-[1.6px] text-muted-foreground">
                On Mesita
              </Text>
              <View className="h-px flex-1 bg-border" />
            </View>
            <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
          </>
        ) : null}
      </ScrollView>

      <SocialProfileSheet
        profile={profile}
        onClose={() => setProfile(null)}
      />
    </View>
  );
}
