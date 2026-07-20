import { Image } from 'expo-image';
import { useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  CarouselPillDots,
  CarouselSlideCounter,
} from '@/components/place/image-carousel-chrome';

export function ImageCarousel({
  photos,
  alt,
  onIdxChange,
}: {
  photos: string[];
  alt: string;
  onIdxChange?: (idx: number) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Screen width minus outer px-4 (16*2) — bare Box has no inner padding.
  const width = Math.max(280, windowWidth - 32);
  const [idx, setIdx] = useState(0);

  if (photos.length === 0) return null;

  const setIndex = (next: number) => {
    if (next === idx || next < 0 || next >= photos.length) return;
    setIdx(next);
    onIdxChange?.(next);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / width);
    setIndex(next);
  };

  return (
    <View className="overflow-hidden rounded-2xl bg-muted">
      <View style={{ width, aspectRatio: 1 }}>
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
          <>
            <CarouselPillDots count={photos.length} activeIdx={idx} />
            <CarouselSlideCounter idx={idx} count={photos.length} />
            <Pressable
              accessibilityLabel="Previous photo"
              onPress={() => setIndex(idx - 1)}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: '33%',
                zIndex: 10,
              }}
            />
            <Pressable
              accessibilityLabel="Next photo"
              onPress={() => setIndex(idx + 1)}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '33%',
                zIndex: 10,
              }}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}
