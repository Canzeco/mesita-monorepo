import { Image } from 'expo-image';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MesitaMark } from '@/components/brand/MesitaMark';
import type { PlaceDetail } from '@/lib/types/place-detail';
import { firstInitial } from '@/lib/utils';

const LONG_QUOTE_THRESHOLD = 220;

type MesitaPayload = {
  kind: 'mesita';
  data: PlaceDetail['mesita_visitors'][number];
};

type GooglePayload = {
  kind: 'google';
  data: PlaceDetail['google_reviews'][number];
};

export function ReviewCard(props: MesitaPayload | GooglePayload) {
  const [expanded, setExpanded] = useState(false);

  if (props.kind === 'mesita') {
    const v = props.data;
    const overall = Math.round(
      (v.food + v.service + v.ambiance + v.value) / 4,
    );
    const isLong = v.quote.length > LONG_QUOTE_THRESHOLD;
    return (
      <View className="w-72 shrink-0 gap-3 rounded-2xl bg-background p-4">
        <Header
          initial={firstInitial(v.name)}
          name={v.name}
          sub={v.handle}
          badge={v.class_key.toUpperCase()}
          mesita
        />
        <StarRow rating={overall} />
        <Text className="text-[10px] leading-snug text-muted-foreground">
          Overall <Text className="font-semibold text-foreground">{overall}</Text>
          {' · '}Food{' '}
          <Text className="font-semibold text-foreground">{v.food}</Text>
          {' · '}Service{' '}
          <Text className="font-semibold text-foreground">{v.service}</Text>
          {' · '}Ambience{' '}
          <Text className="font-semibold text-foreground">{v.ambiance}</Text>
          {' · '}Value{' '}
          <Text className="font-semibold text-foreground">{v.value}</Text>
        </Text>
        <Quote
          text={v.quote}
          italic
          truncated={isLong && !expanded}
          onExpand={
            isLong && !expanded ? () => setExpanded(true) : undefined
          }
        />
        {v.photo_url ? (
          <Image
            source={{ uri: v.photo_url }}
            style={{ width: '100%', height: 120, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : null}
      </View>
    );
  }

  const g = props.data;
  const isLong = g.quote.length > LONG_QUOTE_THRESHOLD;
  return (
    <View className="w-72 shrink-0 gap-3 rounded-2xl bg-background p-4">
      <Header
        initial={firstInitial(g.author)}
        name={g.author}
        sub={g.date}
        google
      />
      <StarRow rating={g.rating} />
      <Quote
        text={g.quote}
        truncated={isLong && !expanded}
        onExpand={isLong && !expanded ? () => setExpanded(true) : undefined}
      />
      {g.photo_url ? (
        <Image
          source={{ uri: g.photo_url }}
          style={{ width: '100%', height: 120, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : null}
    </View>
  );
}

function Header({
  initial,
  name,
  sub,
  badge,
  mesita,
  google,
}: {
  initial: string;
  name: string;
  sub: string;
  badge?: string;
  mesita?: boolean;
  google?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className="size-10 items-center justify-center rounded-full bg-primary/20">
        <Text className="text-sm font-bold text-primary">{initial}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="min-w-0 flex-shrink text-sm font-semibold text-foreground"
            numberOfLines={1}
          >
            {name}
          </Text>
          {badge ? (
            <Text className="rounded-full border border-primary/30 px-1.5 text-[8px] font-bold tracking-wider text-primary uppercase">
              {badge}
            </Text>
          ) : null}
        </View>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {mesita ? <MesitaMark size={18} /> : null}
      {google ? (
        <Text className="text-[10px] font-bold text-muted-foreground">G</Text>
      ) : null}
    </View>
  );
}

function StarRow({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <View className="flex-row gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          color="#fbbf24"
          fill={i < filled ? '#fbbf24' : 'transparent'}
        />
      ))}
    </View>
  );
}

function Quote({
  text,
  italic,
  truncated,
  onExpand,
}: {
  text: string;
  italic?: boolean;
  truncated?: boolean;
  onExpand?: () => void;
}) {
  return (
    <View className="gap-1">
      <Text
        className={`text-sm leading-relaxed text-foreground/85 ${
          italic ? 'italic' : ''
        }`}
        numberOfLines={truncated ? 4 : undefined}
      >
        {text}
      </Text>
      {onExpand ? (
        <Pressable onPress={onExpand}>
          <Text className="text-[11px] font-semibold text-foreground">
            Read more
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
