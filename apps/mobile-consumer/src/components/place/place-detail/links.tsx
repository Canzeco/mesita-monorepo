import { Link2, MapPin, Phone, SquareArrowOutUpRight, type LucideIcon } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import type { PlaceDetail } from '@/lib/types/place-detail';
import { CHANNEL_CLAY, CHANNEL_DEFS, RESERVATION_DEFS } from '../place-detail-links';
import { Box } from './shared';

export function LinksBox({ place }: { place: PlaceDetail }) {
  const chips: {
    key: string;
    label: string;
    Icon: LucideIcon;
    url: string;
  }[] = [];
  if (place.phone) {
    chips.push({
      key: 'phone',
      label: 'Phone',
      Icon: Phone,
      url: `tel:${place.phone.replace(/\s+/g, '')}`,
    });
  }
  for (const def of CHANNEL_DEFS) {
    const url = place.channels[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of RESERVATION_DEFS) {
    const url = place.reservations[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  if (place.reviews_maps.google_maps_url) {
    chips.push({
      key: 'google_maps_url',
      label: 'Google Maps',
      Icon: MapPin,
      url: place.reviews_maps.google_maps_url,
    });
  }
  if (chips.length === 0) return null;

  return (
    <Box title="Channels" icon={Link2} iconColor="#22d3ee">
      <View className="flex-row flex-wrap gap-2">
        {chips.map(({ key, label, Icon, url }) => {
          const clay = CHANNEL_CLAY[key] ?? {
            bg: '#fff9fa',
            text: '#260409',
            border: '#faeff0',
          };
          const leavesApp = !url.startsWith('tel:');
          return (
            <Pressable
              key={key}
              onPress={() => void Linking.openURL(url)}
              className="flex-row items-center gap-1.5 rounded-full border px-3 py-2"
              style={{
                backgroundColor: clay.bg,
                borderColor: clay.border,
              }}
            >
              <Icon color={clay.text} size={14} />
              <Text className="text-xs font-semibold" style={{ color: clay.text }}>
                {label}
              </Text>
              {leavesApp ? (
                <SquareArrowOutUpRight color={clay.text} size={12} opacity={0.55} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Box>
  );
}
