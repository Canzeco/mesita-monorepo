import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { TicketFlowStepper } from '@/components/rewards/TicketFlowStepper';
import { VisitHeaderStatus } from '@/components/rewards/visit-header-status';
import { SHADOW_ELEV } from '@/constants/brand';
import type { TicketFlowStepId, TicketFlowStepView } from '@/lib/ticket-flow-steps';

export function VisitHeader({
  placeName,
  placeHref,
  placePhotoUrl,
  rewardLabel,
  visitDateLabel,
  steps,
  displayStepId,
  onStepSelect,
  transactionSummaryLine,
  statusLine,
}: {
  placeName: string;
  placeHref?: string | null;
  placePhotoUrl?: string | null;
  rewardLabel: string;
  visitDateLabel?: string | null;
  steps: TicketFlowStepView[];
  displayStepId: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  transactionSummaryLine?: string | null;
  statusLine?: string | null;
}) {
  const router = useRouter();
  const pill = {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    borderWidth: 1,
  };

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.15)',
        overflow: 'hidden',
        ...SHADOW_ELEV,
      }}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: '#fff7f8',
              borderWidth: 1,
              borderColor: 'rgba(235,217,219,0.7)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {placePhotoUrl ? (
              <Image
                source={{ uri: placePhotoUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <MapPin color="#775254" size={24} style={{ opacity: 0.4 }} />
            )}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {placeHref ? (
              <Pressable
                onPress={() => router.push(`/place/${placeHref}`)}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="link"
                accessibilityLabel={`View ${placeName}`}
                style={({ pressed }) => ({
                  ...pill,
                  backgroundColor: 'rgba(255,247,248,0.7)',
                  borderColor: 'rgba(235,217,219,0.5)',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: '600' }}
                >
                  {placeName}
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  ...pill,
                  backgroundColor: 'rgba(255,247,248,0.7)',
                  borderColor: 'rgba(235,217,219,0.5)',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 14, fontWeight: '600' }}
                >
                  {placeName}
                </Text>
              </View>
            )}
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(16,185,129,0.1)',
                borderColor: 'rgba(16,185,129,0.2)',
              }}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: '600', color: '#059669' }}
              >
                {rewardLabel}
              </Text>
            </View>
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(255,247,248,0.6)',
                borderColor: 'rgba(235,217,219,0.5)',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: '#775254',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {visitDateLabel ?? '—'}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255,247,248,0.5)',
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: 'rgba(235,217,219,0.5)',
          }}
        >
          <TicketFlowStepper
            steps={steps}
            selectedStepId={displayStepId}
            onSelectStep={onStepSelect}
          />
        </View>

        <VisitHeaderStatus
          transactionSummaryLine={transactionSummaryLine}
          statusLine={statusLine}
        />
      </View>
    </View>
  );
}
