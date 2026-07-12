import { UserPlus } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GiftCardDeck } from '@/components/me/GiftCardDeck';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ShareModal({ visible, onClose }: Props) {
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Share Mesita"
      subtitle="Your seat at the table — pass it on"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
          <Text style={{ fontWeight: '700', fontSize: 20, color: '#260409' }}>
            Share Mesita
          </Text>
          <Text style={{ color: '#775254', fontSize: 13 }}>
            Five gift cards — friend to partner
          </Text>
        </View>
      </View>
      <GiftCardDeck />
    </FullScreenSheet>
  );
}
