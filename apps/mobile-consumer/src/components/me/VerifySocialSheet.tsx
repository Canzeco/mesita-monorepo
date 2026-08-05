import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FullScreenSheet } from '@/components/ui/FullScreenSheet';
import { Switch } from '@/components/ui/Switch';
import { TextField } from '@/components/ui/TextField';
import { GRADIENTS } from '@/constants/brand';
import { apiClaimInstagram } from '@/lib/api/auth';
import { DEMO_INSTAGRAM_FOLLOWERS } from '@/lib/instagram-demo';
import { useMockClass } from '@/lib/mock-class';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';
import { SectionEyebrow } from './class/SectionEyebrow';

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;
const VERIFICATION_CODE_LENGTH = 8;

const WHY_CONNECT_PERKS = [
  {
    label: 'Show up in the feed',
    support: 'Other Mesita guests can see you in Social.',
  },
  {
    label: 'Share & like stories',
    support: 'React to guests’ stories inside Mesita.',
  },
  {
    label: 'Story Bonus on visits',
    support: 'Tag Mesita in a story at the place — bonus on that visit.',
  },
  {
    label: 'Influencer, when you qualify',
    support: 'Connecting is how reach can upgrade your class later.',
  },
] as const;

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
          ? 'Connected — you’re in Social.\nYour class updated.'
          : 'Connected — you’re in Social.';
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
      subtitle="Connect to join Social — feed, stories, and visit bonuses."
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

      <SectionEyebrow>Why connect</SectionEyebrow>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#ebd9db',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        {WHY_CONNECT_PERKS.map((perk, i) => (
          <View
            key={perk.label}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: '#ebd9db',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 14,
                color: '#260409',
              }}
            >
              {perk.label}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 16,
                color: '#775254',
              }}
            >
              {perk.support}
            </Text>
          </View>
        ))}
      </View>

      <SectionEyebrow>Connect</SectionEyebrow>
      {[
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
      ].map((step, i) => (
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
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
      />
      <TextField
        label="8-digit code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={VERIFICATION_CODE_LENGTH}
      />

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
      <Text style={{ textAlign: 'center', color: '#775254', fontSize: 12 }}>
        We never ask for your password.
      </Text>

      {/* Demo chrome — footer ghost module (web InstagramModal parity). */}
      <View
        style={{
          marginTop: 8,
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
        <Text style={{ color: '#775254', fontSize: 11, fontWeight: '500', flex: 1 }}>
          Preview connected
        </Text>
        <Switch
          value={previewConnected}
          onValueChange={(on) => setMockClass(on ? 'influencer' : null)}
          accessibilityLabel="Preview connected Instagram"
        />
      </View>
    </FullScreenSheet>
  );
}
