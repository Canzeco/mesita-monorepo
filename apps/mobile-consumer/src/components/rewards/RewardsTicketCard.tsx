import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { TicketFlowStepper } from '@/components/rewards/TicketFlowStepper';
import { SHADOW_ELEV } from '@/constants/brand';
import type { TicketCardView } from '@/lib/hooks/useConsumerPayTickets';

export function RewardsTicketCard({
  view,
  onOpen,
}: {
  view: TicketCardView;
  onOpen: () => void;
}) {
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Ticket at ${view.placeName}, ${view.timeLabel}`}
      style={({ pressed }) => ({
        borderRadius: 16,
        padding: 12,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(235,217,219,0.7)',
        gap: 12,
        opacity: pressed ? 0.96 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
        ...SHADOW_ELEV,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#fff7f8',
            borderWidth: 1,
            borderColor: 'rgba(235,217,219,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {view.placePhotoUrl ? (
            <Image
              source={{ uri: view.placePhotoUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <MapPin color="#775254" size={20} style={{ opacity: 0.4 }} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ fontWeight: '700' }}
          >
            {view.placeName}
          </Text>
          <Text
            style={{ marginTop: 2, color: '#775254', fontVariant: ['tabular-nums'] }}
          >
            {view.timeLabel}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: 'rgba(255,247,248,0.7)',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: 'rgba(235,217,219,0.5)',
        }}
      >
        <TicketFlowStepper steps={view.steps} />
      </View>
    </Pressable>
  );
}
