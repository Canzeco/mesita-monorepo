import {
  CalendarCheck,
  Heart,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

type SwipeActionRowProps = {
  filtersActive: boolean;
  saved: boolean;
  onOpenFilters: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
};

/** Icon-only five-action row — web swipe-action-row peer. */
export function SwipeActionRow({
  filtersActive,
  saved,
  onOpenFilters,
  onSkip,
  onOpenInfo,
  onSave,
}: SwipeActionRowProps) {
  return (
    <>
      <IconBtn
        accessibilityLabel={filtersActive ? 'Filters (active)' : 'Filters'}
        onPress={onOpenFilters}
        badge={filtersActive}
      >
        <SlidersHorizontal color="#260409" size={20} />
      </IconBtn>
      <IconBtn accessibilityLabel="Skip" onPress={onSkip}>
        <X color="#260409" size={20} />
      </IconBtn>
      <IconBtn accessibilityLabel="About this place" onPress={onOpenInfo}>
        <Store color="#260409" size={20} />
      </IconBtn>
      <IconBtn
        accessibilityLabel={saved ? 'Saved' : 'Save'}
        onPress={onSave}
        saved={saved}
      >
        <Heart
          color={saved ? '#dc2626' : '#775254'}
          fill={saved ? '#dc2626' : 'transparent'}
          size={20}
        />
      </IconBtn>
      <IconBtn
        accessibilityLabel="Reserve (coming soon)"
        disabled
      >
        <CalendarCheck color="rgba(119,82,84,0.55)" size={20} />
      </IconBtn>
    </>
  );
}

function IconBtn({
  children,
  onPress,
  disabled,
  saved,
  badge,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  saved?: boolean;
  badge?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={`h-12 flex-1 items-center justify-center rounded-lg border active:opacity-90 ${
        disabled
          ? 'border-border bg-muted/40'
          : saved
            ? 'border-red-500/50 bg-red-500/12'
            : 'border-border bg-card active:bg-muted'
      }`}
    >
      <View className="relative">
        {children}
        {badge ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500"
            style={{ borderWidth: 2, borderColor: '#fff' }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
