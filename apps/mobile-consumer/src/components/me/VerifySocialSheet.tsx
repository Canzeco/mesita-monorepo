import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { GRADIENTS } from '@/constants/brand';
import { apiClaimInstagram } from '@/lib/api/auth';
import { INFLUENCER_FOLLOWER_THRESHOLD } from '@/lib/consumer-classes';
import { DEMO_INSTAGRAM_FOLLOWERS } from '@/lib/instagram-demo';
import { useMockClass } from '@/lib/mock-class';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;
const VERIFICATION_CODE_LENGTH = 8;

const WHY_LINES = [
  `Your class updates automatically — ${INFLUENCER_FOLLOWER_THRESHOLD.toLocaleString('en-US')}+ followers puts you on Influencer, free, and a better class means better Rewards.`,
  `Post Stories on your visits for even better Rewards.`,
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function VerifySocialSheet({ visible, onClose }: Props) {
  const { refreshProfile } = useAuth();
  const [override, setMockClass] = useMockClass();
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const previewConnected = override === 'influencer';

  const canVerify =
    HANDLE_RE.test(handle.trim()) &&
    code.length >= VERIFICATION_CODE_LENGTH &&
    !verifying;

  async function verify() {
    if (!canVerify) return;
    setVerifying(true);
    try {
      const result = await apiClaimInstagram({
        followers: DEMO_INSTAGRAM_FOLLOWERS,
        handle: handle.trim().replace(/^@/, '').toLowerCase(),
      });
      await refreshProfile();
      const message =
        result.tier === 'influencer'
          ? 'Connected — Rewards unlocked.\nYour class updated.'
          : 'Connected — Rewards unlocked.';
      Alert.alert('Connected', message);
      setHandle('');
      setCode('');
      onClose();
    } catch (e) {
      Alert.alert(
        "Couldn't verify",
        errMsg(e, "Couldn't verify — try again."),
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <FullScreenSheet
      visible={visible}
      onClose={onClose}
      title="Instagram"
      subtitle="Connect Instagram for better Rewards."
    >
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

      <View style={{ gap: 12, marginTop: 4 }}>
        <View
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: 'rgba(235,217,219,0.7)',
            borderRadius: 16,
            padding: 12,
            opacity: 0.85,
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Text
            style={{
              backgroundColor: 'rgba(245,158,11,0.15)',
              color: '#d97706',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              overflow: 'hidden',
              fontWeight: '800',
              letterSpacing: 1.2,
              fontSize: 9,
            }}
          >
            DEMO
          </Text>
          <Text
            style={{
              color: '#775254',
              fontSize: 11,
              fontWeight: '500',
              flex: 1,
            }}
          >
            Preview connected
          </Text>
          <Switch
            value={previewConnected}
            onValueChange={(on) => setMockClass(on ? 'influencer' : null)}
            accessibilityLabel="Preview connected Instagram"
          />
        </View>

        <WhyConnectModule />

        <ConnectModule
          handle={handle}
          code={code}
          verifying={verifying}
          canVerify={canVerify}
          onHandleChange={setHandle}
          onCodeChange={setCode}
          onVerify={() => void verify()}
        />
      </View>
    </FullScreenSheet>
  );
}

function WhyConnectModule() {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        padding: 16,
      }}
    >
      <Text
        style={{
          fontWeight: '800',
          fontSize: 14,
          color: '#260409',
          letterSpacing: -0.1,
        }}
      >
        Why connect
      </Text>
      <View style={{ marginTop: 8, gap: 8 }}>
        {WHY_LINES.map((line) => (
          <View
            key={line}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
          >
            <View
              style={{
                marginTop: 6,
                height: 6,
                width: 6,
                borderRadius: 3,
                backgroundColor: '#c2185b',
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontWeight: '500',
                lineHeight: 18,
                color: '#260409',
              }}
            >
              {line}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ConnectModule({
  handle,
  code,
  verifying,
  canVerify,
  onHandleChange,
  onCodeChange,
  onVerify,
}: {
  handle: string;
  code: string;
  verifying: boolean;
  canVerify: boolean;
  onHandleChange: (v: string) => void;
  onCodeChange: (v: string) => void;
  onVerify: () => void;
}) {
  const steps: { key: string; node: ReactNode }[] = [
    {
      key: '1',
      node: (
        <Text style={{ flex: 1, lineHeight: 20, fontSize: 13, color: '#260409' }}>
          DM <Text style={{ fontWeight: '700', color: '#cf0360' }}>@mesita.bot</Text>{' '}
          the word{' '}
          <Text
            style={{
              fontWeight: '700',
              color: '#cf0360',
              fontFamily: 'monospace',
            }}
          >
            VERIFY
          </Text>
        </Text>
      ),
    },
    {
      key: '2',
      node: (
        <Text style={{ flex: 1, lineHeight: 20, fontSize: 13, color: '#260409' }}>
          Paste the 8-digit code here
        </Text>
      ),
    },
  ];

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#ebd9db',
        backgroundColor: '#ffffff',
        padding: 16,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontWeight: '800',
          fontSize: 14,
          color: '#260409',
          letterSpacing: -0.1,
        }}
      >
        Connect Instagram
      </Text>

      {steps.map((step, i) => (
        <View
          key={step.key}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              backgroundColor: 'rgba(207,3,96,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#cf0360', fontWeight: '800', fontSize: 11 }}>
              {i + 1}
            </Text>
          </View>
          {step.node}
        </View>
      ))}

      <TextField
        label="@handle"
        value={handle}
        onChangeText={onHandleChange}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <TextField
        label="8-digit code"
        value={code}
        onChangeText={onCodeChange}
        keyboardType="number-pad"
        maxLength={VERIFICATION_CODE_LENGTH}
      />

      <Button
        onPress={onVerify}
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
      <Text style={{ textAlign: 'center', color: '#775254', fontSize: 12 }}>
        We never ask for your password.
      </Text>
    </View>
  );
}
