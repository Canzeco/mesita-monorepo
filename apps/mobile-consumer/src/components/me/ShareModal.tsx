import { UserPlus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { Appbar, Modal, Portal, Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GiftCardDeck } from '@/components/me/GiftCardDeck';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShareModal({ visible, onClose }: Props) {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={{
          flex: 1,
          backgroundColor: '#fff7f8',
          margin: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Appbar.Header style={{ backgroundColor: '#fff7f8' }} elevated>
            <Appbar.Content
              title="Share Mesita"
              subtitle="Your seat at the table — pass it on"
            />
            <Appbar.Action icon="close" onPress={onClose} />
          </Appbar.Header>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <LinearGradient
                colors={[...GRADIENTS.pink]}
                start={GRADIENT_DIAGONAL.start}
                end={GRADIENT_DIAGONAL.end}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus color="#fff" size={22} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                  Share Mesita
                </Text>
                <Text variant="bodySmall" style={{ color: '#775254' }}>
                  Five gift cards — friend to partner
                </Text>
              </View>
            </View>
            <GiftCardDeck />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}
