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
import { ReservationSheet } from '@/components/place/place-detail/ReservationSheet';
import { COLORS } from '@/constants/brand';
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
  const [reserveOpen, setReserveOpen] = useState(false);
  const [soonKind, setSoonKind] = useState<'share' | null>(null);
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
          onPress={() => setReserveOpen(true)}
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
      <ReservationSheet
        place={place}
        visible={reserveOpen}
        onClose={() => setReserveOpen(false)}
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
  // Saved used to be four red signals at once (tint, border, icon, label) and
  // red here was never danger — it was a heart. Achromatic, a 12% tint is a
  // 5-point lightness step no one reads, so the state moves onto carriers that
  // never depended on hue: a FILLED heart against an outline one (the glyph
  // does the work), an ink border against the hairline the other three wear,
  // and the label already flipping Save → Saved.
  return (
    <Pressable
      onPress={onPress}
      className={`h-11 flex-1 flex-row items-center justify-center gap-1 rounded-xl border ${
        saved
          ? 'border-foreground bg-muted'
          : 'border-border bg-card active:bg-muted'
      }`}
    >
      <Icon
        color={COLORS.foreground}
        size={15}
        fill={filled ? COLORS.foreground : 'transparent'}
        strokeWidth={2.25}
      />
      <Text
        className="text-[13px] font-semibold text-foreground"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
