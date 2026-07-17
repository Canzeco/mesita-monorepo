import {
  MessageCircle,
  Settings as SettingsIcon,
  Share2,
} from 'lucide-react-native';
import { Linking } from 'react-native';

import { BoxRow } from '@/components/ui/BoxRow';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';

const SUPPORT_EMAIL = 'support@mesita.ai';
const INSTAGRAM_URL = 'https://instagram.com/mesita.ai';

export function ContactSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Contact us"
      subtitle="We usually reply within a day"
    >
      <BoxRow
        Icon={MessageCircle}
        tint="emerald"
        title="Email us"
        summary={SUPPORT_EMAIL}
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
      />
      <BoxRow
        Icon={SettingsIcon}
        tint="amber"
        title="Get help"
        summary="Report a problem or ask a question"
        onPress={() =>
          void Linking.openURL(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              'I need help with Mesita',
            )}`,
          )
        }
      />
      <BoxRow
        Icon={Share2}
        tint="pink"
        title="Instagram"
        summary="@mesita.ai"
        onPress={() => void Linking.openURL(INSTAGRAM_URL)}
      />
    </FullScreenSheet>
  );
}
