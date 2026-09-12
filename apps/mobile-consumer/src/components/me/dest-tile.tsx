import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useReduceMotion } from '@/lib/useReduceMotion';

export function DestGrid({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-3">{children}</View>;
}

export function DestTile({
  Icon,
  title,
  summary,
  href,
  soon = false,
}: {
  Icon: LucideIcon;
  title: string;
  summary: string;
  href?: Href;
  soon?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const inert = soon || !href;
  return (
    <Pressable
      onPress={inert ? undefined : () => router.push(href!)}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert }}
      accessibilityLabel={soon ? `${title}, coming soon` : `${title}. ${summary}`}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 92,
          opacity: inert ? 0.6 : pressed && !reduceMotion ? 0.92 : 1,
          transform: [{ scale: pressed && !inert && !reduceMotion ? 0.98 : 1 }],
        },
      ]}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-3.5"
    >
      <Text
        className="font-bold text-foreground"
        style={{ fontSize: 14 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {soon ? (
        <View className="mt-1 self-start rounded-full border border-border px-1.5 py-0.5">
          <Text
            className="font-semibold uppercase text-muted-foreground"
            style={{ fontSize: 8, letterSpacing: 1.2 }}
          >
            Soon
          </Text>
        </View>
      ) : (
        <Text
          className="mt-0.5 pr-9 text-muted-foreground"
          style={{ fontSize: 12 }}
          numberOfLines={2}
        >
          {summary}
        </Text>
      )}
      <View className="pointer-events-none absolute bottom-2 right-2.5 opacity-20">
        <Icon color="#260409" size={40} />
      </View>
    </Pressable>
  );
}
