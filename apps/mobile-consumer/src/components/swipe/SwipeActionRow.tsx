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
        tone="amber"
        onPress={onOpenFilters}
        showDot={filtersActive}
      />
      <ActionBtn label="Skip" Icon={X} tone="rose" big onPress={onSkip} />
      <ActionBtn
        label="About this place"
        Icon={Store}
        tone="sky"
        onPress={onOpenInfo}
      />
      <ActionBtn
        label={saved ? 'Saved' : 'Save'}
        Icon={Heart}
        tone="pink"
        big
        onPress={onSave}
        filled={saved}
      />
      <ActionBtn
        label="Reserve a table"
        Icon={CalendarCheck}
        tone="violet"
        onPress={onReserve}
      />
    </>
  );
}
