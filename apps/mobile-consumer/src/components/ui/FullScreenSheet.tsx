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
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Form sheet (issue called this BottomSheet). RN Modal for keyboard + Android
// back — more reliable than absolute Portal overlays for long forms.
// PortalHost stays mounted in root for lightweight portals (MESITA-583).
export function FullScreenSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View className="flex-row items-start gap-3 border-b border-border px-4 py-3">
            <View className="min-w-0 flex-1">
              <Text
                className="font-display font-bold text-foreground"
                style={{ fontSize: 20 }}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text
                  className="mt-0.5 text-muted-foreground"
                  style={{ fontSize: 13 }}
                >
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-muted"
            >
              <X color="#260409" size={20} />
            </Pressable>
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
    </Modal>
  );
}

/** Alias for issue MESITA-583 naming (form sheets). */
export { FullScreenSheet as BottomSheet };
