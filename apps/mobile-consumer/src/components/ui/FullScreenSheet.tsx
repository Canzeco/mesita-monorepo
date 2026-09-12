import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Form sheet: RN Modal for keyboard + Android back — more reliable than
// absolute Portal overlays for long forms. PortalHost stays mounted in root
// for lightweight portals (MESITA-583).
//
// asRoute (MESITA-1789): Me boxes are real Expo routes, not Modal overlays.
// Same chrome (title + body), Back instead of Close, no Modal wrapper so the
// tab bar stays and history pops to the hub.

function SheetChrome({
  title,
  subtitle,
  onClose,
  asRoute,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  asRoute?: boolean;
  children: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-2 border-b border-border px-3 py-3">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={asRoute ? 'Back' : 'Close'}
            hitSlop={12}
            className="h-9 w-9 items-center justify-center rounded-lg border border-border bg-card"
          >
            {asRoute ? (
              <ArrowLeft color="#260409" size={16} />
            ) : (
              <X color="#260409" size={20} />
            )}
          </Pressable>
          <View className="min-w-0 flex-1">
            <Text
              className="text-center font-display font-semibold text-foreground"
              style={{ fontSize: 20 }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="mt-0.5 text-center text-muted-foreground"
                style={{ fontSize: 12 }}
                numberOfLines={2}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View className="h-9 w-9" />
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FullScreenSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  asRoute = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  asRoute?: boolean;
}) {
  const chrome = (
    <SheetChrome
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      asRoute={asRoute}
    >
      {children}
    </SheetChrome>
  );
  if (asRoute) return chrome;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {chrome}
    </Modal>
  );
}
