import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { TicketFlowStepper } from '@/components/rewards/TicketFlowStepper';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import type { TicketFlowStepId, TicketFlowStepView } from '@/lib/ticket-flow-steps';

export function VisitHeader({
  placeName,
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
  placePhotoUrl?: string | null;
  rewardLabel: string;
  visitDateLabel?: string | null;
  steps: TicketFlowStepView[];
  displayStepId: TicketFlowStepId;
  onStepSelect?: (id: TicketFlowStepId) => void;
  transactionSummaryLine?: string | null;
  statusLine?: string | null;
}) {
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
            <View
              style={{
                ...pill,
                backgroundColor: 'rgba(255,247,248,0.7)',
                borderColor: 'rgba(235,217,219,0.5)',
              }}
            >
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600' }}>
                {placeName}
              </Text>
            </View>
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

        {transactionSummaryLine ? (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Status summary
            </Text>
            <Text
              style={{
                marginTop: 4,
                color: '#fff',
                fontSize: 12,
                fontWeight: '500',
                lineHeight: 16,
              }}
            >
              {transactionSummaryLine}
            </Text>
          </LinearGradient>
        ) : statusLine ? (
          <View
            style={{
              backgroundColor: 'rgba(255,247,248,0.7)',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: 'rgba(235,217,219,0.5)',
            }}
          >
            <Text
              style={{
                color: '#775254',
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              Status summary
            </Text>
            <Text
              style={{
                marginTop: 2,
                color: '#260409',
                fontSize: 14,
                fontWeight: '500',
              }}
            >
              {statusLine}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
