import { Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';

import {
  ACTIVITY_KIND_META,
  type ConsumerActivity,
} from '@/lib/consumer-activity-data';

export function ConsumerActivityList({
  items,
  anonymisedNote = false,
}: {
  items: ConsumerActivity[];
  anonymisedNote?: boolean;
}) {
  return (
    <View className="gap-2">
      {items.map((a) => {
        const meta = ACTIVITY_KIND_META[a.kind];
        const Icon = meta.Icon;
        return (
          <View
            key={a.id}
            className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <View
              className="h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: meta.bg }}
            >
              <Icon color={meta.color} size={16} strokeWidth={2.25} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[13px] leading-[18px] text-foreground">
                {a.handle ? (
                  <Text className="font-semibold">{a.handle} </Text>
                ) : null}
                {a.verb}{' '}
                {a.place ? (
                  <Text className="font-semibold">{a.place}</Text>
                ) : null}
              </Text>
              <Text className="mt-0.5 text-[11px] text-muted-foreground">
                {a.when}
              </Text>
            </View>
          </View>
        );
      })}
      {anonymisedNote ? (
        <View className="flex-row items-center justify-center gap-1.5 pt-1">
          <Sparkles color="#775254" size={12} />
          <Text className="text-[11px] text-muted-foreground">
            Anonymised — handles, places, and amounts are shuffled.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
