import { LinearGradient } from 'expo-linear-gradient';
import { UserPlus } from 'lucide-react-native';
import { View } from 'react-native';

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
      {/* Branded icon tile only — the sheet header already carries the title,
          so the body no longer repeats it (de-dup, DeleteAccountSheet DNA). */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <UserPlus color="#fff" size={22} />
        </LinearGradient>
      </View>
      <GiftCardDeck />
    </FullScreenSheet>
  );
}
