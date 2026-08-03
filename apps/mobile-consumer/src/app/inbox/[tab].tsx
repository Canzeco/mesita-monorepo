import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsumerActivityList } from '@/components/inbox/ConsumerActivityList';
import { InboxSegmentTabs } from '@/components/inbox/inbox-segment-tabs';
import {
  NotificationRow,
  SkeletonRow,
} from '@/components/inbox/NotificationRows';
import { ShellWash } from '@/components/ui/HeroBackdrop';
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from '@/lib/api/notifications';
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from '@/lib/consumer-activity-data';
import { inboxPath } from '@/lib/consumer-route-contract';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export type InboxTab = 'mine' | 'global';

const NOTIFICATIONS_LOAD_ERROR = "Couldn't load notifications.";

function tabFromParam(raw: string | string[] | undefined): InboxTab {
  const seg = Array.isArray(raw) ? raw[0] : raw;
  if (seg === 'global' || seg === 'global-activity') return 'global';
  return 'mine';
}

export default function InboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const initialTab = tabFromParam(params.tab);
  const [tab, setTab] = useState<InboxTab>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState<InboxTab>(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  const [rows, setRows] = useState<ConsumerNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setLoading(Boolean(userId));
    setError(null);
  }

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await fetchConsumerNotifications(userId);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(errMsg(e, NOTIFICATIONS_LOAD_ERROR));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchConsumerNotifications(userId);
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(errMsg(e, NOTIFICATIONS_LOAD_ERROR));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  usePayNotificationPoll(load, Boolean(userId));

  // Legacy web segments → canonical mine/global (after hooks).
  if (rawTab === 'my-activity') {
    return <Redirect href={inboxPath('mine')} />;
  }
  if (rawTab === 'global-activity') {
    return <Redirect href={inboxPath('global')} />;
  }

  const myCount = rows.length + MY_ACTIVITY.length;
  const globalCount = GLOBAL_ACTIVITY.length;

  const onTabChange = (next: InboxTab) => {
    setTab(next);
    router.push(inboxPath(next));
  };

  return (
    <ShellWash>
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="flex-row items-center px-2 pb-1">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text className="text-base font-medium text-primary">← Back</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-4 pb-10"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-[1.8px] text-muted-foreground">
              Inbox
            </Text>
            <Text className="mt-0.5 font-display text-lg font-semibold text-foreground">
              {tab === 'mine'
                ? 'Your recent moves'
                : "What's happening on Mesita"}
            </Text>
          </View>

          <InboxSegmentTabs
            active={tab}
            onChange={onTabChange}
            myCount={myCount}
            globalCount={globalCount}
          />

          {error ? (
            <View className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <Text className="text-sm text-destructive">{error}</Text>
            </View>
          ) : null}

          {tab === 'global' ? (
            <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
          ) : loading ? (
            <View className="gap-2">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} />
              ))}
            </View>
          ) : (
            <View className="gap-4">
              {rows.length === 0 && MY_ACTIVITY.length === 0 && !error ? (
                <View className="items-center rounded-2xl border border-border bg-card px-4 py-8">
                  <Bell color="#775254" size={40} style={{ opacity: 0.5 }} />
                  <Text className="mt-3 text-sm text-muted-foreground">
                    No notifications yet.
                  </Text>
                </View>
              ) : (
                <>
                  {rows.length > 0 ? (
                    <View className="gap-2">
                      {rows.map((n) => (
                        <NotificationRow key={n.id} n={n} />
                      ))}
                    </View>
                  ) : null}
                  {MY_ACTIVITY.length > 0 ? (
                    <ConsumerActivityList items={MY_ACTIVITY} />
                  ) : null}
                </>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ShellWash>
  );
}
