import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
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
