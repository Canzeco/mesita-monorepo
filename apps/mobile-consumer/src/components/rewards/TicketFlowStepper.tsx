import {
  Banknote,
  Check,
  AtSign,
  QrCode,
  ReceiptText,
  Star,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import type {
  TicketFlowStepId,
  TicketFlowStepView,
} from '@/lib/ticket-flow-steps';

const STEP_ICONS: Record<TicketFlowStepId, LucideIcon> = {
  scan: QrCode,
  bill: ReceiptText,
  story: AtSign,
  pay: Banknote,
  review: Star,
};

function StepCircle({
  step,
  Icon,
  selected,
}: {
  step: TicketFlowStepView;
  Icon: LucideIcon;
  selected?: boolean;
}) {
  if (step.state === 'done') {
    return (
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          backgroundColor: '#10b981',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check color="#fff" size={16} strokeWidth={2.5} />
      </View>
    );
  }

  if (step.state === 'active') {
    return (
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          ...(selected
            ? { borderWidth: 2, borderColor: 'rgba(139,108,232,0.5)' }
            : null),
          ...SHADOW_GLOW,
        }}
      >
        <Icon color="#fff" size={16} strokeWidth={2} />
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(235,217,219,0.9)',
        backgroundColor: 'rgba(255,247,248,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon color="#775254" size={16} strokeWidth={2} />
    </View>
  );
}

export function TicketFlowStepper({
  steps,
  selectedStepId,
  onSelectStep,
}: {
  steps: TicketFlowStepView[];
  selectedStepId?: TicketFlowStepId;
  onSelectStep?: (stepId: TicketFlowStepId) => void;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}
      accessibilityRole="list"
      accessibilityLabel="Visit progress"
    >
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.id];
        const isSelected = selectedStepId === step.id;
        const canSelect =
          onSelectStep && (step.state === 'done' || step.state === 'active');
        const circle = (
          <StepCircle step={step} Icon={Icon} selected={isSelected} />
        );

        return (
          <View
            key={`${step.id}-${i}`}
            style={{ flexDirection: 'row', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}
          >
            {canSelect ? (
              <Pressable
                onPress={() => onSelectStep(step.id)}
                accessibilityLabel={`${step.label} — ${step.state}`}
              >
                {circle}
              </Pressable>
            ) : (
              <View accessibilityLabel={`${step.label} — ${step.state}`}>
                {circle}
              </View>
            )}
            {i < steps.length - 1 ? (
              <View
                style={{
                  height: 3,
                  flex: 1,
                  marginHorizontal: 4,
                  borderRadius: 999,
                  backgroundColor:
                    step.state === 'done' ? '#10b981' : '#ebd9db',
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
