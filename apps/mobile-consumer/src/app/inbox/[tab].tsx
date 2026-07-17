import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ConsumerActivityList,
  InboxSegmentTabs,
} from '@/components/inbox/ConsumerActivityList';
import {
  NotificationRow,
  SkeletonRow,
} from '@/components/inbox/NotificationRows';
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from '@/lib/api/notifications';
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from '@/lib/consumer-activity-data';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export type InboxTab = 'mine' | 'global';

function tabFromParam(raw: string | string[] | undefined): InboxTab {
  const seg = Array.isArray(raw) ? raw[0] : raw;
  if (seg === 'global' || seg === 'global-activity') return 'global';
  return 'mine';
}

export default function InboxScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
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
      setError(errMsg(e, "Couldn't load notifications."));
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
        if (!cancelled) setError(errMsg(e, "Couldn't load notifications."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  usePayNotificationPoll(load, Boolean(userId));

  const myCount = rows.length + MY_ACTIVITY.length;
  const globalCount = GLOBAL_ACTIVITY.length;

  const onTabChange = (next: InboxTab) => {
    setTab(next);
    router.setParams({ tab: next });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff7f8' }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingBottom: 4,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={{ padding: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text
            style={{
              fontSize: 16,
              color: '#fb2b7b',
              fontFamily: 'Inter_500Medium',
            }}
          >
            ← Back
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text
            style={{
              fontSize: 10,
              fontFamily: 'Inter_700Bold',
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: '#775254',
            }}
          >
            Inbox
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontSize: 18,
              fontFamily: 'Fraunces_600SemiBold',
              color: '#260409',
            }}
          >
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
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#fecaca',
              backgroundColor: '#fef2f2',
              padding: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: '#b91c1c',
                fontFamily: 'Inter_400Regular',
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        {tab === 'global' ? (
          <ConsumerActivityList items={GLOBAL_ACTIVITY} anonymisedNote />
        ) : loading ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((i) => (
              <SkeletonRow key={i} />
            ))}
            <ActivityIndicator color="#fb2b7b" style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            {rows.length === 0 && MY_ACTIVITY.length === 0 && !error ? (
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#ebd9db',
                  backgroundColor: '#ffffff',
                  paddingHorizontal: 16,
                  paddingVertical: 32,
                  alignItems: 'center',
                }}
              >
                <Bell color="#775254" size={40} style={{ opacity: 0.5 }} />
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    color: '#775254',
                    fontFamily: 'Inter_400Regular',
                  }}
                >
                  No notifications yet.
                </Text>
              </View>
            ) : (
              <>
                {rows.length > 0 ? (
                  <View style={{ gap: 8 }}>
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
  );
}
