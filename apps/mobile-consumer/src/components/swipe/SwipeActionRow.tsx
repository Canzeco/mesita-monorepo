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
  onOpenFilters: () => void;
  onSkip: () => void;
  onOpenInfo: () => void;
  onSave: () => void;
};

export function SwipeActionRow({
  saved,
  onOpenFilters,
  onSkip,
  onOpenInfo,
  onSave,
}: SwipeActionRowProps) {
  return (
    <>
      <ActionBtn
        label="Filter"
        Icon={SlidersHorizontal}
        onPress={onOpenFilters}
      />
      <ActionBtn label="Skip" Icon={X} onPress={onSkip} />
      <ActionBtn label="Info" Icon={Store} onPress={onOpenInfo} />
      <ActionBtn
        label={saved ? 'Saved' : 'Save'}
        Icon={Heart}
        onPress={onSave}
        primary={saved}
        filled={saved}
      />
      <ActionBtn
        label="Reserve"
        Icon={CalendarCheck}
        onPress={() => undefined}
        disabled
      />
    </>
  );
}
