import type { ComponentType } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

// RN port of web ComingSoonModal — parked surfaces stay tappable; gate is
// one shared dialog (MESITA-383). Used by the tab bar (Rewards), place
// Reserve/Share, and other parked CTAs.

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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  icon?: IconComponent;
}) {
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
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Icon color="#775254" size={24} strokeWidth={1.75} />
            </View>
            <Text
              className="mt-4 text-center font-semibold text-foreground"
              style={{ fontSize: 16 }}
            >
              {title}
            </Text>
            <Text
              className="mt-1.5 max-w-[280px] text-center text-muted-foreground"
              style={{ fontSize: 14, lineHeight: 20 }}
            >
              {body ??
                "We're still polishing this. It'll land here shortly — thanks for waiting."}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Got it"
              onPress={onClose}
              className="mt-5 h-10 w-full items-center justify-center rounded-xl bg-foreground"
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <Text
                className="font-semibold text-background"
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
