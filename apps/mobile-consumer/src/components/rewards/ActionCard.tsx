import { LinearGradient } from 'expo-linear-gradient';
import { QrCode } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { LockedBanner, TipRows } from '@/components/rewards/action-card-tips';
import { TicketBillReceipt } from '@/components/rewards/TicketBillReceipt';
import { Button } from '@/components/ui/Button';
import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_ELEV } from '@/constants/brand';
import type { TicketBillPayload } from '@/lib/api/pay';
import {
  STEP_DONE_LINE,
  STEP_NOW_TITLE,
  ticketProgressFromBundle,
  ticketStepDummyInstructions,
  type TicketFlowStepView,
} from '@/lib/ticket-flow-steps';
import { StatusPill } from './StatusPill';

export function ActionCard({
  step,
  progress,
  payload,
  ticketKind,
  capMxn,
  placeInstagramHandle,
  onShowQr,
  children,
}: {
  step: TicketFlowStepView;
  progress: ReturnType<typeof ticketProgressFromBundle>;
  payload: TicketBillPayload;
  ticketKind?: string | null;
  capMxn?: number | null;
  placeInstagramHandle?: string | null;
  onShowQr: () => void;
  children?: ReactNode;
}) {
  const isDone = step.state === 'done';
  const isActive = step.state === 'active';
  const isLocked = step.state === 'upcoming';
  const tips = isActive
    ? ticketStepDummyInstructions(step.id, progress, { placeInstagramHandle })
    : [];
  const showBillReceipt =
    (step.id === 'bill' || step.id === 'pay') &&
    !!payload.total_cents &&
    !isLocked;

  return (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: '#ffffff',
        borderWidth: isActive ? 2 : 1,
        borderColor: isActive ? 'rgba(251,43,123,0.35)' : '#ebd9db',
        overflow: 'hidden',
        ...SHADOW_ELEV,
      }}
    >
      {isActive ? (
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{ paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <StatusPill done={isDone} active={isActive} locked={isLocked} />
          <Text
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: '700',
              color: '#fff',
              lineHeight: 26,
            }}
          >
            {STEP_NOW_TITLE[step.id]}
          </Text>
        </LinearGradient>
      ) : (
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: isDone
              ? 'rgba(16,185,129,0.1)'
              : 'rgba(255,247,248,0.5)',
          }}
        >
          <StatusPill done={isDone} active={isActive} locked={isLocked} />
          <Text
            style={{
              marginTop: 8,
              fontSize: 20,
              fontWeight: '700',
              color: isLocked ? '#775254' : '#260409',
              lineHeight: 26,
            }}
          >
            {STEP_NOW_TITLE[step.id]}
          </Text>
          {isDone ? (
            <Text
              style={{
                marginTop: 4,
                fontSize: 14,
                fontWeight: '500',
                color: '#059669',
              }}
            >
              {STEP_DONE_LINE[step.id]}
            </Text>
          ) : null}
        </View>
      )}

      <View style={{ padding: 16, gap: 16 }}>
        {isLocked ? <LockedBanner /> : null}

        {isActive && tips.length > 0 ? <TipRows tips={tips} /> : null}

        {showBillReceipt ? (
          <TicketBillReceipt
            payload={payload}
            ticketKind={ticketKind}
            capMxn={capMxn}
            placeName={payload.place_name}
          />
        ) : null}

        {step.id === 'scan' && !isLocked ? (
          <View style={{ opacity: isActive ? 1 : 0.75 }}>
            <Button
              onPress={onShowQr}
              accessibilityLabel="Show my QR code"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <QrCode color="#fff" size={20} />
                <Text
                  style={{
                    color: '#fffafb',
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  Show my QR code
                </Text>
              </View>
            </Button>
          </View>
        ) : null}

        {children}

        {isDone && step.id !== 'bill' && !children ? (
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#775254' }}>
            Nothing else needed for this step.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
