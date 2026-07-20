import type { ComponentType } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { COLORS } from '@/constants/brand';

// RN port of web ComingSoonModal (+ HomeModeNav ComingSoon via variant).
// Parked surfaces stay tappable; gate is one shared dialog (MESITA-383).

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

export function ComingSoonModal({
  open,
  onClose,
  title,
  body,
  icon: Icon = Sparkles,
  variant = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: IconComponent;
  /** `homeMode` matches web HomeModeNav Social dialog (badge + primary tint). */
  variant?: 'default' | 'homeMode';
}) {
  const homeMode = variant === 'homeMode';
  const iconBg = homeMode ? 'rgba(251, 43, 123, 0.1)' : COLORS.muted;
  const iconColor = homeMode ? COLORS.primary : COLORS.mutedForeground;
  const defaultBody =
    "We're still polishing this. It'll land here shortly — thanks for waiting.";

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onClose}
        className="flex-1 items-center justify-center bg-foreground/40 px-6"
      >
        <Pressable
          accessibilityRole="none"
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-[340px] rounded-2xl border border-border bg-card"
          style={{
            shadowColor: '#260409',
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 12 },
            elevation: 12,
          }}
        >
          <View className="items-center px-6 pb-6 pt-7">
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: iconBg }}
            >
              <Icon
                color={iconColor}
                size={homeMode ? 28 : 24}
                strokeWidth={homeMode ? 2 : 1.75}
              />
            </View>

            {homeMode ? (
              <View className="mt-3 rounded-full bg-primary/10 px-2.5 py-0.5">
                <Text
                  className="font-bold uppercase text-primary"
                  style={{ fontSize: 10, letterSpacing: 1.4 }}
                >
                  Coming soon
                </Text>
              </View>
            ) : null}

            <Text
              className={
                homeMode
                  ? 'mt-3 text-center font-display text-xl font-semibold text-foreground'
                  : 'mt-4 text-center font-semibold text-foreground'
              }
              style={homeMode ? undefined : { fontSize: 16 }}
            >
              {title}
            </Text>
            <Text
              className="mt-1.5 max-w-[280px] text-center text-muted-foreground"
              style={{ fontSize: 14, lineHeight: homeMode ? 18 : 20 }}
            >
              {body ?? defaultBody}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Got it"
              onPress={onClose}
              className={
                homeMode
                  ? 'mt-4 h-11 w-full items-center justify-center rounded-full bg-primary'
                  : 'mt-5 h-10 w-full items-center justify-center rounded-xl bg-foreground'
              }
              style={({ pressed }) => [
                {
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text
                className={
                  homeMode
                    ? 'font-semibold text-primary-foreground'
                    : 'font-semibold text-background'
                }
                style={{ fontSize: 14 }}
              >
                Got it
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
