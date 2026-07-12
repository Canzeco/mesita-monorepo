import type { LucideIcon } from 'lucide-react-native';
import { Sparkles } from 'lucide-react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { View } from 'react-native';

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
  icon?: LucideIcon;
}) {
  return (
    <Portal>
      <Modal
        visible={open}
        onDismiss={onClose}
        contentContainerStyle={{
          marginHorizontal: 24,
          borderRadius: 20,
          backgroundColor: '#ffffff',
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: 24,
        }}
      >
        <View className="items-center">
          <View className="size-14 items-center justify-center rounded-2xl bg-muted">
            <Icon color="#775254" size={24} strokeWidth={1.75} />
          </View>
          <Text
            variant="titleMedium"
            style={{ marginTop: 16, fontWeight: '600', textAlign: 'center' }}
          >
            {title}
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              marginTop: 8,
              textAlign: 'center',
              color: '#775254',
              maxWidth: 280,
              lineHeight: 20,
            }}
          >
            {body ??
              "We're still polishing this. It'll land here shortly — thanks for waiting."}
          </Text>
          <Button
            mode="contained"
            onPress={onClose}
            buttonColor="#260409"
            textColor="#fff"
            style={{ marginTop: 20, borderRadius: 12, width: '100%' }}
            contentStyle={{ height: 44 }}
          >
            Got it
          </Button>
        </View>
      </Modal>
    </Portal>
  );
}
