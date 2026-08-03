import { LinearGradient } from 'expo-linear-gradient';
import { Check, Crown, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

export type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  title: string;
  via?: string;
  accent?: boolean;
  price: string;
  priceNote?: string;
  desc: string;
  /** The class's perks, rendered as a check-list between desc and footer. */
  perks?: string[];
  reached: boolean;
  reachedLabel: string;
  /** Secondary actions render as a quiet outline button (web parity). */
  action?: { label: string; onPress: () => void; secondary?: boolean };
  note?: string;
  /** Custom icon-tile gradient (e.g. Influencer sky, Aura gold). Wins over
   *  the accent default. */
  iconColors?: readonly [string, string, ...string[]];
};

export function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;
  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRadius: 10,
          backgroundColor: 'rgba(16,185,129,0.15)',
          paddingVertical: 10,
        }}
      >
        <Check color="#047857" size={14} strokeWidth={3} />
        <Text
          style={{ color: '#047857', fontWeight: '700' }}
        >
          {data.reachedLabel}
        </Text>
      </View>
    );
  } else if (data.action) {
    footer = (
      <Button
        onPress={data.action.onPress}
        variant={data.action.secondary ? 'outline' : 'primary'}
        accessibilityLabel={data.action.label}
      >
        {data.action.label}
      </Button>
    );
  } else if (data.note) {
    footer = (
      <View
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#ebd9db',
          backgroundColor: '#faeff0',
          paddingVertical: 10,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#775254' }}>
          {data.note}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: data.accent ? 'rgba(139,108,232,0.3)' : '#ebd9db',
        backgroundColor: data.accent
          ? 'rgba(139,108,232,0.03)'
          : '#ffffff',
        padding: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {data.iconColors ? (
          <LinearGradient
            colors={[...data.iconColors]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon color="#fff" size={24} />
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={
              data.accent
                ? [...GRADIENTS.pink]
                : (['#faeff0', '#faeff0'] as const)
            }
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon color={data.accent ? '#fff' : '#260409'} size={24} />
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {data.accent ? (
              <Crown color="#6d4fd8" size={16} fill="#6d4fd8" />
            ) : null}
            <Text
              style={{
                fontWeight: '700',
                color: data.accent ? '#6d4fd8' : '#260409',
              }}
            >
              {data.title}
            </Text>
            {data.via ? (
              <Text style={{ color: '#775254' }}>
                via {data.via}
              </Text>
            ) : null}
          </View>
          <Text
            style={{ fontWeight: '700', marginTop: 8 }}
          >
            {data.price}
          </Text>
          {data.priceNote ? (
            <Text
              style={{ color: '#775254', marginTop: 2 }}
            >
              {data.priceNote}
            </Text>
          ) : null}
        </View>
      </View>
      <Text
        style={{ color: '#775254', marginTop: 16, lineHeight: 18 }}
      >
        {data.desc}
      </Text>
      {data.perks && data.perks.length > 0 ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {data.perks.map((perk) => (
            <View
              key={perk}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
            >
              <View
                style={{
                  marginTop: 1,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: data.accent
                    ? 'rgba(139,108,232,0.15)'
                    : 'rgba(16,185,129,0.15)',
                }}
              >
                <Check
                  color={data.accent ? '#6d4fd8' : '#047857'}
                  size={12}
                  strokeWidth={3}
                />
              </View>
              <Text style={{ flex: 1, color: 'rgba(38,4,9,0.85)', fontSize: 12.5 }}>
                {perk}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {footer ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
    </View>
  );
}
