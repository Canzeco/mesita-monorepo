import {
  CalendarCheck,
  Heart,
  SlidersHorizontal,
  Store,
  X,
} from 'lucide-react-native';

import { ActionBtn } from '@/components/swipe/swipe-deck-shells';

type SwipeActionRowProps = {
  saved: boolean;
  filtersActive: boolean;
  onOpenFilters: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
  onReserve: () => void;
};

export function SwipeActionRow({
  saved,
  filtersActive,
  onOpenFilters,
  onSkip,
  onOpenInfo,
  onSave,
  onReserve,
}: SwipeActionRowProps) {
  return (
    <>
      <ActionBtn
        label="Filters"
        Icon={SlidersHorizontal}
        variant="utility"
        onPress={onOpenFilters}
        showDot={filtersActive}
      />
      <ActionBtn label="Skip" Icon={X} variant="skip" onPress={onSkip} />
      <ActionBtn
        label="About this place"
        Icon={Store}
        variant="utility"
        onPress={onOpenInfo}
      />
      <ActionBtn
        label={saved ? 'Saved' : 'Save'}
        Icon={Heart}
        variant="save"
        onPress={onSave}
        filled={saved}
      />
      <ActionBtn
        label="Reserve a table"
        Icon={CalendarCheck}
        variant="utility"
        onPress={onReserve}
      />
    </>
  );
}
