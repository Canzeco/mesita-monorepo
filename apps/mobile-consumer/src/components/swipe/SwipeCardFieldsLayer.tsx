import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { SwipeCardInfo } from '@/components/swipe/SwipeCardInfo';
import {
  SWIPE_CARD_FIELDS_INNER,
  SWIPE_CARD_WITC_FIELDS_TARGET_H,
} from '@/components/swipe/swipe-card-styles';
import type { Place } from '@/lib/api/places';
import {
  isSplitLayout,
  type SwipeCardLayoutMode,
} from '@/lib/swipe-card-layout';

/** Hidden sizing clone — same inner node as the live fields layer. */
export function SwipeCardFieldsMeasure({
  place,
  onHeight,
}: {
  place: Place;
  onHeight: (height: number) => void;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        opacity: 0,
        zIndex: -1,
      }}
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
    >
      <View className={SWIPE_CARD_FIELDS_INNER}>
        <SwipeCardInfo place={place} compact />
      </View>
    </View>
  );
}

/**
 * Bottom-anchored fields for TIWC (gradient overlay) and WITC (reflection strip).
 */
export function SwipeCardFieldsLayer({
  place,
  mode,
  fieldsHeight,
}: {
  place: Place;
  mode: SwipeCardLayoutMode;
  fieldsHeight: number;
}) {
  const split = isSplitLayout(mode);
  const contentHeight = split
    ? Math.max(Math.min(fieldsHeight, SWIPE_CARD_WITC_FIELDS_TARGET_H), 1)
    : Math.max(fieldsHeight, 1);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: contentHeight,
        zIndex: 10,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
      }}
    >
      {!split ? (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.34)', 'rgba(0,0,0,0.58)']}
          locations={[0, 0.4, 1]}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        />
      ) : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <View className={SWIPE_CARD_FIELDS_INNER}>
          <SwipeCardInfo place={place} compact />
        </View>
      </View>
    </View>
  );
}
