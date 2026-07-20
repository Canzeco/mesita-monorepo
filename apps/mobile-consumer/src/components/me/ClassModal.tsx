import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { ClassPreviewToggle } from './class/ClassPreviewToggle';
import { CurrentClassCard } from './class/CurrentClassCard';
import { FreeVsPremium } from './class/FreeVsPremium';
import { SectionEyebrow } from './class/SectionEyebrow';
import { WaysToClimb } from './class/WaysToClimb';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
};

export function ClassModal({
  visible,
  onClose,
  onConnectInstagram,
}: Props) {
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Your class"
      subtitle="Free or Premium — and how to climb"
    >
      <View className="mb-1 flex-row items-center gap-3">
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
          <Crown color="#fff" size={20} />
        </LinearGradient>
        <View className="min-w-0 flex-1">
          <Text
            className="font-display font-bold text-foreground"
            style={{ fontSize: 18 }}
          >
            Climb your class
          </Text>
          <Text className="text-muted-foreground" style={{ fontSize: 12 }}>
            Status here · subscribe on web
          </Text>
        </View>
      </View>

      <ClassPreviewToggle />
      <SectionEyebrow>Current class</SectionEyebrow>
      <CurrentClassCard />
      <SectionEyebrow>Comparison</SectionEyebrow>
      <FreeVsPremium />
      <SectionEyebrow>Classes</SectionEyebrow>
      <WaysToClimb onConnectInstagram={onConnectInstagram} />
    </FullScreenSheet>
  );
}
