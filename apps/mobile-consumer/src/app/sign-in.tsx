import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import {
  Button,
  HelperText,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GRADIENTS } from '@/constants/brand';
import { apiConsumerSigninPhone } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';

// Phone OTP: signInWithOtp → verifyOtp → consumer-web-signin-phone.
const DIAL_PREFIX = '+52';

export default function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [localNumber, setLocalNumber] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = `${DIAL_PREFIX}${localNumber.replace(/\D/g, '')}`;
  const phoneOk = localNumber.replace(/\D/g, '').length >= 10;
  const codeOk = token.trim().length === 6;

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep('code');
  };

  const verifyCode = async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: e164,
      token: token.trim(),
      type: 'sms',
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    try {
      await apiConsumerSigninPhone();
    } catch {
      // Gate profile fetch covers routing.
    }
    setBusy(false);
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff7f8' }}>
      <LinearGradient
        colors={[...GRADIENTS.hero]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <View style={{ marginBottom: 40, alignItems: 'center' }}>
            <Text variant="displaySmall" style={{ color: '#260409' }}>
              Mesita
            </Text>
            <Text
              variant="bodyMedium"
              style={{ marginTop: 12, textAlign: 'center', color: '#775254' }}
            >
              Tu mesa favorita te está esperando
            </Text>
          </View>

          <Surface
            elevation={2}
            style={{
              borderRadius: 16,
              padding: 24,
              backgroundColor: '#ffffff',
            }}
          >
            {step === 'phone' ? (
              <>
                <Text
                  variant="labelSmall"
                  style={{ marginBottom: 8, color: '#775254', letterSpacing: 1.2 }}
                >
                  PHONE NUMBER
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Surface
                    elevation={0}
                    style={{
                      backgroundColor: '#faeff0',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 14,
                    }}
                  >
                    <Text variant="titleSmall">{DIAL_PREFIX}</Text>
                  </Surface>
                  <TextInput
                    mode="outlined"
                    style={{ flex: 1, backgroundColor: '#ffffff' }}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="55 1234 5678"
                    value={localNumber}
                    onChangeText={setLocalNumber}
                    dense
                  />
                </View>
                <Button
                  mode="contained"
                  onPress={() => void sendCode()}
                  loading={busy}
                  disabled={!phoneOk || busy}
                  style={{ marginTop: 16 }}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Send code
                </Button>
              </>
            ) : (
              <>
                <Text
                  variant="labelSmall"
                  style={{ marginBottom: 8, color: '#775254', letterSpacing: 1.2 }}
                >
                  CODE SENT TO {e164}
                </Text>
                <TextInput
                  mode="outlined"
                  style={{
                    backgroundColor: '#ffffff',
                    textAlign: 'center',
                    letterSpacing: 8,
                    fontSize: 24,
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  placeholder="••••••"
                  value={token}
                  onChangeText={setToken}
                />
                <Button
                  mode="contained"
                  onPress={() => void verifyCode()}
                  loading={busy}
                  disabled={!codeOk || busy}
                  style={{ marginTop: 16 }}
                  contentStyle={{ paddingVertical: 6 }}
                >
                  Verify
                </Button>
                <Button
                  mode="text"
                  onPress={() => setStep('phone')}
                  style={{ marginTop: 4 }}
                  compact
                >
                  Change number
                </Button>
              </>
            )}
            {error ? (
              <HelperText type="error" visible style={{ marginTop: 8 }}>
                {error}
              </HelperText>
            ) : null}
          </Surface>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
