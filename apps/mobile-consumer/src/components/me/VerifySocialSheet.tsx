import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, BadgeCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  HelperText,
  Modal,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiClaimInstagram } from '@/lib/api/auth';
import { DEMO_INSTAGRAM_FOLLOWERS } from '@/lib/instagram-demo';
import { errMsg } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

const HANDLE_RE = /^@?[A-Za-z0-9._]{1,30}$/;

type Props = {
  visible: boolean;
  onClose: () => void;
};

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
      Alert.alert('Connected', 'Instagram connected — Mesita Premium unlocked.');
      setHandle('');
      setCode('');
      onClose();
    } catch (e) {
      Alert.alert(
        "Couldn't verify",
        errMsg(e, "Couldn't verify your Instagram — try again."),
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={{
          flex: 1,
          backgroundColor: '#fff7f8',
          margin: 0,
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <Appbar.Header style={{ backgroundColor: '#fff7f8' }} elevated>
            <Appbar.Content
              title="Verify Instagram"
              subtitle="via @mesita.bot · 1-minute setup"
            />
            <Appbar.Action icon="close" onPress={onClose} />
          </Appbar.Header>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <LinearGradient
                colors={['#f58529', '#dd2a7b', '#8134af']}
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
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>
                  Verify Instagram
                </Text>
                <Text variant="bodySmall" style={{ color: '#775254' }}>
                  1,000+ followers unlocks Premium
                </Text>
              </View>
            </View>

            {[
              'Follow @mesita.bot on Instagram.',
              'DM @mesita.bot with the word VERIFY.',
              'Mesita will reply with an 8-digit verification code. Paste it here.',
              '1,000+ followers unlocks Mesita Premium instantly.',
            ].map((line, i) => (
              <View
                key={line}
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
                  <Text
                    variant="labelSmall"
                    style={{ color: '#ec006c', fontWeight: '800' }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{ flex: 1, lineHeight: 20 }}
                >
                  {line}
                </Text>
              </View>
            ))}

            <TextInput
              mode="outlined"
              label="@your.instagram"
              value={handle}
              onChangeText={setHandle}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={31}
              style={{ backgroundColor: '#ffffff' }}
            />
            <TextInput
              mode="outlined"
              label="Paste 8-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={8}
              style={{ backgroundColor: '#ffffff' }}
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Button
                mode="outlined"
                onPress={onClose}
                style={{ flex: 1 }}
                contentStyle={{ paddingVertical: 4 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={() => void verify()}
                disabled={!canVerify}
                loading={verifying}
                buttonColor="#ec006c"
                icon={() => <BadgeCheck color="#fff" size={16} />}
                style={{ flex: 1 }}
                contentStyle={{ paddingVertical: 4 }}
              >
                {verifying ? 'Connecting…' : 'Verify'}
              </Button>
            </View>
            <HelperText type="info" visible style={{ textAlign: 'center' }}>
              We never ask for your Instagram password.
            </HelperText>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}
