import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASS_MARK_ICON } from '@/lib/consumer-classes';
import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';
import { ClassPreviewToggle } from './class/ClassPreviewToggle';
import { ClassRail } from './class/ClassRail';
import { CurrentClassCard } from './class/CurrentClassCard';
import { SectionEyebrow } from './class/SectionEyebrow';
import { WaysToClimb } from './class/WaysToClimb';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConnectInstagram: () => void;
  asRoute?: boolean;
};

export function ClassModal({
  visible,
  onClose,
  onConnectInstagram,
  asRoute = false,
}: Props) {
  const router = useRouter();
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      asRoute={asRoute}
      title="Your class"
      subtitle="Reach, subscribe, or get invited — rewards climb with you."
    >
      {/* Branded pyramid mark (web ClassModal DNA). The sheet header already
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
          <CLASS_MARK_ICON color="#fff" size={22} />
        </LinearGradient>
      </View>
      <ClassRail />
      <SectionEyebrow>You</SectionEyebrow>
      <CurrentClassCard />
      <SectionEyebrow>Classes</SectionEyebrow>
      <WaysToClimb
        onConnectInstagram={onConnectInstagram}
        onRedeemInvite={() =>
          router.push(CONSUMER_ROUTES.mePages.classInvite)
        }
      />
      <ClassPreviewToggle />
    </FullScreenSheet>
  );
}
