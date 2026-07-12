import { Image } from 'expo-image';
import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

export function ImageCarousel({
  photos,
  alt,
}: {
  photos: string[];
  alt: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Screen width minus outer px-4 (16*2) — bare Box has no inner padding.
  const width = Math.max(280, windowWidth - 32);
  const [idx, setIdx] = useState(0);

  if (photos.length === 0) return null;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / width);
    if (next !== idx && next >= 0 && next < photos.length) setIdx(next);
  };

  return (
    <View className="overflow-hidden rounded-2xl bg-muted">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ width, aspectRatio: 1 }}
      >
        {photos.map((uri, i) => (
          <Image
            key={`${uri}-${i}`}
            source={{ uri }}
            accessibilityLabel={`${alt} photo ${i + 1}`}
            style={{ width, height: width }}
            contentFit="cover"
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
          {photos.map((_, i) => (
            <View
              key={i}
              className={`h-1.5 rounded-full ${
                i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
