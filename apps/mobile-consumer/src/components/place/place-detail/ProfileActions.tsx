import {
  CalendarCheck,
  Heart,
  MessageCircle,
  Phone,
  Share2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { PlaceContactSheet } from '@/components/place/PlaceContactSheet';
import { useSavedPlaces } from '@/lib/saved-places';
import type { PlaceDetail } from '@/lib/types/place-detail';

export function ProfileActions({
  place,
  onSaveToggle,
}: {
  place: PlaceDetail;
  onSaveToggle?: (saved: boolean) => void;
}) {
  const { isSaved, setSaved } = useSavedPlaces();
  const [contactOpen, setContactOpen] = useState(false);
  const [soonKind, setSoonKind] = useState<'reserve' | 'share' | null>(null);
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = isSaved(place.id);

  function onSave() {
    const next = !saved;
    setSaved(place.id, next);
    onSaveToggle?.(next);
  }

  return (
    <>
      <View className="mt-5 flex-row gap-2">
        <ActionBtn
          label={saved ? 'Saved' : 'Save'}
          onPress={onSave}
          saved={saved}
          Icon={Heart}
          filled={saved}
        />
        <ActionBtn
          label="Contact"
          onPress={() => setContactOpen(true)}
          Icon={hasWhatsApp ? MessageCircle : Phone}
        />
        <ActionBtn
          label="Reserve"
          onPress={() => setSoonKind('reserve')}
          Icon={CalendarCheck}
        />
        <ActionBtn
          label="Share"
          onPress={() => setSoonKind('share')}
          Icon={Share2}
        />
      </View>
      <PlaceContactSheet
        place={place}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
      <ComingSoonModal
        open={soonKind === 'reserve'}
        onClose={() => setSoonKind(null)}
        title="Reservations coming soon"
        body="Book a table from Mesita shortly — for now, use Contact to reach the place."
        icon={CalendarCheck}
      />
      <ComingSoonModal
        open={soonKind === 'share'}
        onClose={() => setSoonKind(null)}
        title="Sharing coming soon"
        body="You'll be able to share this place with friends from here soon."
        icon={Share2}
      />
    </>
  );
}

function ActionBtn({
  label,
  onPress,
  Icon,
  saved,
  filled,
}: {
  label: string;
  onPress: () => void;
  Icon: LucideIcon;
  saved?: boolean;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center justify-center gap-1 rounded-xl border ${
        saved
          ? 'border-red-500/50 bg-red-500/12'
          : 'border-border bg-card active:bg-muted'
      }`}
    >
      <Icon
        color={saved ? '#dc2626' : '#260409'}
        size={15}
        fill={filled ? '#dc2626' : 'transparent'}
        strokeWidth={2.25}
      />
      <Text
        className={`text-[13px] font-semibold ${
          saved ? 'text-red-600' : 'text-foreground'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
