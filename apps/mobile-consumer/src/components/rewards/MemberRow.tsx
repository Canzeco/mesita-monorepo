// The Mesita Card demoted to a compact identity row (MESITA-808, 2A) —
// mobile mirror. The passport QR is GONE: nothing scans `mesita:<code>` since
// Tickets v2, and two QRs on one page meant waiters scanning the dead one.
// Member code stays as text + copy (the WhatsApp staff bot takes it typed).

import * as Clipboard from 'expo-clipboard';
import { AtSign, Check, Copy, Crown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { classProperLabel, isElevatedClass } from '@/lib/consumer-classes';
import { displayConsumerCode } from '@/lib/consumer-code';
import { firstInitials } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export function MemberRow({
  code,
  name,
  instagramHandle,
}: {
  code: string;
  name?: string;
  instagramHandle?: string | null;
}) {
  const displayCode = displayConsumerCode(code);
  const { consumerClass } = useAuth();
  const key = consumerClass?.class ?? 'standard';
  const isElevated = isElevatedClass(key);
  const displayName = name?.trim() || 'Mesita member';

  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text className="font-extrabold text-white" style={{ fontSize: 14 }}>
          {firstInitials(displayName)}
        </Text>
      </LinearGradient>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="font-bold text-foreground"
            numberOfLines={1}
            style={{ fontSize: 13.5, flexShrink: 1 }}
          >
            {displayName}
          </Text>
          <View
            className={`flex-row items-center gap-1 rounded-full px-1.5 py-0.5 ${
              isElevated ? 'bg-premium/10' : 'bg-primary/10'
            }`}
          >
            {isElevated ? <Crown size={10} color="#ce74e3" fill="#ce74e3" /> : null}
            <Text
              className={`font-extrabold uppercase ${
                isElevated ? 'text-premium' : 'text-primary'
              }`}
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              {classProperLabel(key)}
            </Text>
          </View>
        </View>
        <View className="mt-0.5 flex-row items-center gap-1">
          {instagramHandle ? (
            <>
              <AtSign size={12} color="#775254" />
              <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
                @{instagramHandle}
              </Text>
            </>
          ) : (
            <Text className="text-muted-foreground" style={{ fontSize: 11 }}>
              Mesita Card
            </Text>
          )}
        </View>
      </View>
      {/* Member code — TEXT only, deliberately no QR on this row. */}
      <Pressable
        onPress={() => void onCopy()}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Code copied' : 'Copy member code'}
        className="flex-row items-center gap-1.5"
        style={{ minHeight: 44 }}
      >
        <Text
          className="font-semibold text-foreground"
          style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 2 }}
        >
          {displayCode}
        </Text>
        {copied ? (
          <Check size={14} color="#059669" />
        ) : (
          <Copy size={14} color="#775254" />
        )}
      </Pressable>
    </View>
  );
}
