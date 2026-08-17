import { Bell } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ConsumerActivityList } from '@/components/inbox/ConsumerActivityList';
import {
  NotificationRow,
  SkeletonRow,
} from '@/components/inbox/NotificationRows';
import {
  fetchConsumerNotifications,
  type ConsumerNotification,
} from '@/lib/api/notifications';
import { MY_ACTIVITY } from '@/lib/consumer-activity-data';
import { usePayNotificationPoll } from '@/lib/hooks/usePayNotificationPoll';
import { errMsg } from '@/lib/utils';

const NOTIFICATIONS_LOAD_ERROR = "Couldn't load notifications.";

// YOUR activity feed and nothing else (Pato, 2026-08-17), web parity.
//
// The My activity / Global activity toggle is gone. Global activity was never
// a notification — nothing happened to YOU — it's other people moving, which
// is exactly the Social feed's job, so it moved to Home > Social.
export function InboxNotificationsSection({ userId }: { userId: string }) {
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

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-3 px-4 pt-3 pb-10"
      showsVerticalScrollIndicator={false}
    >
      <Text className="mt-0.5 font-display text-lg font-semibold text-foreground">
        Your recent moves
      </Text>

      {error ? (
        <View className="rounded-xl border border-destructive/30 bg-destructive/10 p-3">
          <Text className="text-sm text-destructive">{error}</Text>
        </View>
      ) : null}

      {loading ? (
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
  );
}
