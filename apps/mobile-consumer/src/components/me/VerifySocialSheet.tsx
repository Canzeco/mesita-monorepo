import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { TextField } from '@/components/ui/TextField';
import { GRADIENTS } from '@/constants/brand';
import { apiClaimInstagram } from '@/lib/api/auth';
import { DEMO_INSTAGRAM_FOLLOWERS } from '@/lib/instagram-demo';
import { toast } from '@/lib/toast';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

type Props = {
  visible: boolean;
  onClose: () => void;
};

function Em({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontWeight: '700', color: '#ec006c' }}>{children}</Text>
  );
}

const STEP_LINES: ReactNode[] = [
  <>
    Follow <Em>@mesita.bot</Em> on Instagram.
  </>,
  <>
    DM <Em>@mesita.bot</Em> with the word <Em>VERIFY</Em>.
  </>,
  <>Mesita will reply with an 8-digit verification code. Paste it here.</>,
  <>1,000+ followers unlocks Mesita Premium instantly.</>,
];

export function VerifySocialSheet({ visible, onClose }: Props) {
  const { refreshProfile } = useAuth();
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const canVerify =
    HANDLE_RE.test(handle.trim()) && code.length >= 8 && !verifying;

  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      await apiClaimInstagram({
        followers: DEMO_INSTAGRAM_FOLLOWERS,
        handle: handle.trim().replace(/^@/, '').toLowerCase(),
      });
      await refreshProfile();
      toast.success('Instagram connected — Mesita Premium unlocked.');
      setHandle('');
      setCode('');
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Couldn't verify your Instagram — try again."));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Verify Instagram"
      subtitle="via @mesita.bot · 1-minute setup"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <LinearGradient
          colors={[...GRADIENTS.instagram]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AtSign color="#fff" size={22} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text
            className="font-display font-bold text-foreground"
            style={{ fontSize: 16 }}
          >
            1,000+ followers unlocks Premium
          </Text>
          <Text className="text-muted-foreground" style={{ fontSize: 13 }}>
            We never ask for your Instagram password.
          </Text>
        </View>
      </View>

      {STEP_LINES.map((line, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: 'rgba(236,0,108,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#ec006c', fontWeight: '800', fontSize: 11 }}>
              {i + 1}
            </Text>
          </View>
          <Text
            style={{ flex: 1, lineHeight: 20, fontSize: 14, color: '#260409' }}
          >
            {line}
          </Text>
        </View>
      ))}

      <TextField
        label="@your.instagram"
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <TextField
        label="Paste 8-digit code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={8}
      />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <View style={{ flex: 1 }}>
          <Button variant="outline" onPress={onClose}>
            Cancel
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            onPress={() => void verify()}
            disabled={!canVerify}
            loading={verifying}
            accessibilityLabel="Verify Instagram"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BadgeCheck color="#fff" size={16} />
              <Text style={{ color: '#fffafb', fontWeight: '600', fontSize: 14 }}>
                Verify
              </Text>
            </View>
          </Button>
        </View>
      </View>
    </FullScreenSheet>
  );
}
