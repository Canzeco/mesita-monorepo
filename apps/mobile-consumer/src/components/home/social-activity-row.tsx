import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AtSign, Crown, Magnet } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { placePath } from '@/lib/consumer-route-contract';
import {
  SOCIAL_ACTION_META,
  type SocialPerson,
} from '@/lib/social-feed-data';
import { firstInitial } from '@/lib/utils';

// One activity feed row: person (profile sheet) + place chip (detail nav).
// Mirrors web SocialActivityRow.
export function SocialActivityRow({
  person,
  place,
  onPersonClick,
}: {
  person: SocialPerson;
  place: Place | null;
  onPersonClick: (person: SocialPerson) => void;
}) {
  const router = useRouter();
  const meta = SOCIAL_ACTION_META[person.action];
  const ActionIcon = meta.Icon;

  return (
    <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card p-2.5">
      <Pressable
        onPress={() => onPersonClick(person)}
        accessibilityLabel={`${person.name} profile`}
        className="min-w-0 flex-1 flex-row items-center gap-3 active:opacity-90"
      >
        <View className="relative shrink-0">
          <Image
            source={{ uri: person.avatarUrl }}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            contentFit="cover"
          />
          {person.plan === 'magnetic' ? (
            <View className="absolute -bottom-0.5 -left-0.5 size-4 items-center justify-center rounded-full bg-amber-400">
              <Magnet color="#fff" size={10} />
            </View>
          ) : null}
          {person.plan === 'premium' ? (
            <View
              className="absolute -bottom-0.5 -left-0.5 size-4 items-center justify-center rounded-full"
              style={{ backgroundColor: '#8b6ce8' }}
            >
              <Crown color="#fff" size={10} fill="#fff" />
            </View>
          ) : null}
          <LinearGradient
            colors={[...GRADIENTS.instagram]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 16,
              height: 16,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#fff',
            }}
          >
            <AtSign color="#fff" size={9} />
          </LinearGradient>
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text
              className="text-sm font-semibold text-foreground"
              numberOfLines={1}
            >
              {person.name}
            </Text>
            <View
              className={`flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5 ${meta.bg}`}
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
          <Text className="mt-0.5 text-[11px] text-muted-foreground" numberOfLines={1}>
            {person.igHandle} · {person.time}
          </Text>
        </View>
      </Pressable>

      {place ? (
        <Pressable
          onPress={() => router.push(placePath(place.slug || place.id))}
          accessibilityLabel={`Open ${place.name}`}
          className="max-w-[40%] flex-row items-center gap-2 rounded-xl border border-border bg-background/80 p-1.5 pr-2 active:opacity-90"
        >
          <PlaceThumb name={place.name} photo={place.photos[0]} />
          <Text
            className="max-w-[80px] text-[11px] font-semibold text-foreground"
            numberOfLines={1}
          >
            {place.name}
          </Text>
        </Pressable>
      ) : (
        <View className="max-w-[40%] flex-row items-center gap-2 rounded-xl border border-border bg-muted/40 p-1.5 pr-2">
          <PlaceThumb name={person.fallbackPlaceName} />
          <Text
            className="max-w-[80px] text-[11px] font-semibold text-muted-foreground"
            numberOfLines={1}
          >
            {person.fallbackPlaceName}
          </Text>
        </View>
      )}
    </View>
  );
}

function PlaceThumb({ name, photo }: { name: string; photo?: string }) {
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: 36, height: 36, borderRadius: 8 }}
        contentFit="cover"
      />
    );
  }
  return (
    <LinearGradient
      colors={[...GRADIENTS.pink]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text className="font-display text-sm font-bold text-white/85">
        {firstInitial(name)}
      </Text>
    </LinearGradient>
  );
}
