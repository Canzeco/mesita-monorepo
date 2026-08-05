import { LinearGradient } from 'expo-linear-gradient';
import { Crown } from 'lucide-react-native';
import { View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { ClassComparison } from './class/ClassComparison';
import { ClassPreviewToggle } from './class/ClassPreviewToggle';
import { CurrentClassCard } from './class/CurrentClassCard';
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
      subtitle="Standard, Influencer, Premium or Aura — and how to climb"
    >
      {/* Branded crown-icon tile (web ClassModal DNA). The sheet header already
          carries the title, so the body leads with the mark only. */}
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
          <Crown color="#fff" size={22} />
        </LinearGradient>
      </View>
      <ClassPreviewToggle />
      <SectionEyebrow>Current class</SectionEyebrow>
      <CurrentClassCard />
      <SectionEyebrow>Comparison</SectionEyebrow>
      <ClassComparison />
      <SectionEyebrow>Classes</SectionEyebrow>
      <WaysToClimb onConnectInstagram={onConnectInstagram} />
    </FullScreenSheet>
  );
}
