import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  SwipeCardFieldsLayer,
  SwipeCardFieldsMeasure,
} from '@/components/swipe/SwipeCardFieldsLayer';
import { StaticPhotoSlide } from '@/components/swipe/SwipePhotoSlide';
import { SWIPE_CARD_FACE } from '@/components/swipe/swipe-card-styles';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import type { Place } from '@/lib/api/places';
import { useSwipeCardPhotoLayout } from '@/lib/use-swipe-card-layout';
import { firstInitial } from '@/lib/utils';

/**
 * Swipe card face — web PlaceSwipeCardFace peer (TIWC/WITC + reflection +
 * tap-zone carousel on the active card).
 */
export function PlaceSwipeCard({
  place,
  carousel = false,
}: {
  place: Place;
  carousel?: boolean;
}) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const {
    fieldsHeight,
    onCardLayout,
    onFieldsLayout,
    getPhotoLayoutMode,
    reportPhotoSize,
  } = useSwipeCardPhotoLayout(place.photos);

  const hasPhotos = place.photos.length > 0;
  const photoCount = place.photos.length;
  const safeIdx =
    photoCount === 0 ? 0 : Math.min(activePhotoIdx, photoCount - 1);
  const activePhoto = place.photos[safeIdx];
  const activeMode = activePhoto
    ? getPhotoLayoutMode(activePhoto)
    : ('tiwc' as const);

  const goPrev = () => {
    if (!carousel || photoCount < 2) return;
    setActivePhotoIdx((i) => (i - 1 + photoCount) % photoCount);
  };
  const goNext = () => {
    if (!carousel || photoCount < 2) return;
    setActivePhotoIdx((i) => (i + 1) % photoCount);
  };

  return (
    <View
      className={SWIPE_CARD_FACE}
      style={{ flex: 1 }}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        onCardLayout(width, height);
      }}
    >
      <SwipeCardFieldsMeasure place={place} onHeight={onFieldsLayout} />

      {hasPhotos && activePhoto ? (
        <View className="absolute inset-0">
          <StaticPhotoSlide
            key={`${place.id}-${safeIdx}`}
            src={activePhoto}
            alt={`${place.name} photo ${safeIdx + 1}`}
            layoutMode={activeMode}
            fieldsHeight={fieldsHeight}
            onNaturalSize={(size) => reportPhotoSize(activePhoto, size)}
          />
          <SwipeCardFieldsLayer
            place={place}
            mode={activeMode}
            fieldsHeight={fieldsHeight}
          />
          {carousel && photoCount > 1 ? (
            <>
              <View
                pointerEvents="none"
                className="absolute inset-x-0 top-3 z-20 flex-row justify-center gap-1.5"
              >
                {place.photos.map((_, i) => (
                  <View
                    key={i}
                    className={`h-1.5 rounded-full ${
                      i === safeIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/60'
                    }`}
                    style={{
                      shadowColor: '#000',
                      shadowOpacity: 0.55,
                      shadowRadius: 3,
                    }}
                  />
                ))}
              </View>
              <View className="absolute top-3 right-3 z-20 rounded-full bg-black/60 px-2 py-0.5">
                <Text className="text-[10px] font-semibold text-white">
                  {safeIdx + 1} / {photoCount}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Previous photo"
                onPress={goPrev}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '33%',
                  zIndex: 15,
                }}
              />
              <Pressable
                accessibilityLabel="Next photo"
                onPress={goNext}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: '33%',
                  zIndex: 15,
                }}
              />
            </>
          ) : null}
        </View>
      ) : (
        <PhotoPlaceholder name={place.name} />
      )}
    </View>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  return (
    <LinearGradient
      colors={[...GRADIENTS.pink]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{ position: 'absolute', width: '100%', height: '100%' }}
    >
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-7xl font-bold text-white/70">
          {firstInitial(name)}
        </Text>
      </View>
    </LinearGradient>
  );
}
