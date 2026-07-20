import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

type Day = { day: string; range: string; bars: number[] };

/** Interactive popular-times card — web PopularTimesCard peer. */
export function PopularTimesCard({
  popularTimes,
  initialDay,
}: {
  popularTimes: Day[];
  initialDay: string;
}) {
  const [selectedDay, setSelectedDay] = useState(initialDay.toUpperCase());
  const featured =
    popularTimes.find((d) => d.day.toUpperCase() === selectedDay) ??
    popularTimes[0];

  if (!featured) return null;

  return (
    <View className="w-72 shrink-0 flex-col gap-3 rounded-2xl bg-background p-4">
      <View>
        <Text className="font-display text-base font-semibold text-foreground">
          Popular times
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          From Google · {featured.day} · {featured.range}
        </Text>
      </View>
      <View className="flex-row gap-1">
        {popularTimes.map((d) => {
          const active = d.day.toUpperCase() === selectedDay;
          return (
            <Pressable
              key={d.day}
              onPress={() => setSelectedDay(d.day.toUpperCase())}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="flex-1 overflow-hidden rounded-md"
            >
              {active ? (
                <LinearGradient
                  colors={[...GRADIENTS.pink]}
                  start={GRADIENT_DIAGONAL.start}
                  end={GRADIENT_DIAGONAL.end}
                  style={{
                    paddingVertical: 4,
                    alignItems: 'center',
                    borderRadius: 6,
                  }}
                >
                  <Text className="text-[9px] font-bold tracking-wider text-white uppercase">
                    {d.day}
                  </Text>
                </LinearGradient>
              ) : (
                <View className="items-center rounded-md bg-muted/30 py-1">
                  <Text className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">
                    {d.day}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <View className="h-32 flex-row items-end gap-1.5">
        {featured.bars.map((v, i) => (
          <LinearGradient
            key={i}
            colors={['#a855f7', '#ec4899']}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={{
              flex: 1,
              height: Math.max(v * 128, 8),
              borderRadius: 999,
            }}
          />
        ))}
      </View>
    </View>
  );
}
