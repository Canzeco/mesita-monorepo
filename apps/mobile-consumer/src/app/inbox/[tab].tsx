import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, MapPin, Star } from 'lucide-react-native';
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
  fetchConsumerNotifications,
  type ConsumerNotification,
} from '@/lib/api/notifications';
import { formatPayMx } from '@/lib/api/pay';
import {
  GLOBAL_ACTIVITY,
  MY_ACTIVITY,
} from '@/lib/consumer-activity-data';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export type InboxTab = 'mine' | 'global';

function kindLabel(kind: string): string {
  if (kind === 'bill') return 'Your bill';
  if (kind === 'review') return 'Review update';
  return 'Update';
}

function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  if (kind === 'review') return <Star color="#775254" size={size} />;
  return <Bell color="#775254" size={size} />;
}

function NotificationRow({ n }: { n: ConsumerNotification }) {
  const p = n.bill;
  const reward =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        padding: 12,
      }}
    >
      <View
        style={{
          height: 64,
          width: 64,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#faeff0',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {p.place_photo_url ? (
          <Image
            source={{ uri: p.place_photo_url }}
            style={{ height: 64, width: 64 }}
            contentFit="cover"
          />
        ) : (
          <MapPin color="#775254" size={20} style={{ opacity: 0.4 }} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14,
            lineHeight: 18,
            fontFamily: 'Inter_600SemiBold',
            color: '#260409',
          }}
        >
          {p.place_name ?? 'Mesita partner'}
        </Text>
        <View
          style={{
            marginTop: 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <KindIcon kind={n.kind} />
          <Text
            style={{
              fontSize: 12,
              color: '#775254',
              fontFamily: 'Inter_400Regular',
            }}
          >
            {kindLabel(n.kind)}
          </Text>
        </View>
        {reward > 0 ? (
          <Text
            style={{
              marginTop: 4,
              fontSize: 12,
              fontFamily: 'Inter_500Medium',
              color: '#0284c7',
            }}
          >
            Reward {formatPayMx(reward, p.currency)}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: 4,
            fontSize: 10,
            color: '#775254',
            fontFamily: 'Inter_400Regular',
          }}
        >
          {new Date(n.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View
      style={{
        height: 88,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        opacity: 0.7,
      }}
    />
  );
}

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
