import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { isSplitLayout, type SwipeCardLayoutMode } from '@/lib/swipe-card-layout';
import type { ImageNaturalSize } from '@/lib/use-swipe-card-layout';
import { SWIPE_CARD_WITC_FIELDS_TARGET_H } from '@/components/swipe/swipe-card-styles';

/**
 * TIWC — cover over the full card.
 * WITC — cover in the top band + vertically mirrored strip below (PR #424 peer).
 */
export function StaticPhotoSlide({
  src,
  alt,
  layoutMode,
  fieldsHeight,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  layoutMode: SwipeCardLayoutMode;
  fieldsHeight: number;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  if (isSplitLayout(layoutMode)) {
    return (
      <WitcPhotoSlide
        src={src}
        alt={alt}
        fieldsHeight={fieldsHeight}
        onNaturalSize={onNaturalSize}
      />
    );
  }
  return <TiwcPhotoSlide src={src} alt={alt} onNaturalSize={onNaturalSize} />;
}

function WitcPhotoSlide({
  src,
  alt,
  fieldsHeight,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  fieldsHeight: number;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  const stripHeight = Math.max(
    Math.min(fieldsHeight, SWIPE_CARD_WITC_FIELDS_TARGET_H),
    1,
  );

  return (
    <View className="relative h-full w-full flex-col overflow-hidden">
      <View className="relative min-h-0 flex-1 overflow-hidden">
        <CoverImage
          src={src}
          alt={alt}
          onNaturalSize={onNaturalSize}
          contentPosition="bottom"
        />
      </View>
      {/* Reflection: flipped copy of the same cover — mirrors web SwipePhotoSlide. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: stripHeight,
          transform: [{ scaleY: -1 }],
          overflow: 'hidden',
        }}
      >
        <CoverImage src={src} alt="" contentPosition="bottom" />
      </View>
      <View
        style={{ height: stripHeight }}
        className="relative shrink-0 overflow-hidden rounded-b-3xl"
        pointerEvents="none"
      >
        <View className="absolute inset-0 bg-black/20" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.64)']}
          locations={[0, 0.45, 1]}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      </View>
    </View>
  );
}

function TiwcPhotoSlide({
  src,
  alt,
  onNaturalSize,
}: {
  src: string;
  alt: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
}) {
  return (
    <View className="relative h-full w-full overflow-hidden">
      <CoverImage src={src} alt={alt} onNaturalSize={onNaturalSize} />
    </View>
  );
}

function CoverImage({
  src,
  alt,
  onNaturalSize,
  contentPosition = 'center',
}: {
  src: string;
  alt: string;
  onNaturalSize?: (size: ImageNaturalSize) => void;
  contentPosition?: 'center' | 'bottom';
}) {
  return (
    <Image
      source={{ uri: src }}
      accessibilityLabel={alt || undefined}
      style={{ position: 'absolute', width: '100%', height: '100%' }}
      contentFit="cover"
      contentPosition={contentPosition}
      transition={0}
      onLoad={(e) => {
        const { width, height } = e.source;
        if (width > 0 && height > 0) onNaturalSize?.({ width, height });
      }}
    />
  );
}
