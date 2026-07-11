import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientButton } from '@/components/ui/gradient-button';
import { GRADIENTS } from '@/constants/brand';
import { apiConsumerSigninPhone } from '@/lib/api/auth';
import { supabase } from '@/lib/supabase';

// Port of the web PhoneOtpForm: signInWithOtp → verifyOtp(type "sms"),
// then the consumer-web-signin-phone EF (the web /auth/post-signin hop).
// Default country MX (+52), same as the web's COUNTRY_BY_CODE default.
const DIAL_PREFIX = '+52';

export default function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [localNumber, setLocalNumber] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = `${DIAL_PREFIX}${localNumber.replace(/\D/g, '')}`;

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
      // Stamps role + lazy-creates the consumers row; the entry gate at "/"
      // then routes to onboard or tabs off the refreshed profile.
      await apiConsumerSigninPhone();
    } catch {
      // Non-fatal: the gate's profile fetch covers routing either way.
    }
    setBusy(false);
    router.replace('/');
  };

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[...GRADIENTS.hero]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 380 }}
      />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center px-6"
        >
          <View className="mb-10 items-center">
            <Text className="font-display text-5xl text-foreground">Mesita</Text>
            <Text className="mt-3 text-center text-sm text-muted-foreground">
              Tu mesa favorita te está esperando
            </Text>
          </View>

          <View className="rounded-3xl border border-border bg-card p-6">
            {step === 'phone' ? (
              <>
                <Text className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Phone number
                </Text>
                <View className="flex-row items-center gap-2">
                  <View className="rounded-lg bg-muted px-3 py-3">
                    <Text className="text-sm font-semibold text-foreground">{DIAL_PREFIX}</Text>
                  </View>
                  <TextInput
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-3 text-base text-foreground"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="55 1234 5678"
                    placeholderTextColor="#775254"
                    value={localNumber}
                    onChangeText={setLocalNumber}
                  />
                </View>
                <View className="mt-4">
                  <GradientButton
                    label="Send code"
                    onPress={() => void sendCode()}
                    loading={busy}
                    disabled={localNumber.replace(/\D/g, '').length < 10}
                  />
                </View>
              </>
            ) : (
              <>
                <Text className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Code sent to {e164}
                </Text>
                <TextInput
                  className="rounded-lg border border-input bg-card px-3 py-3 text-center text-2xl tracking-[8px] text-foreground"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  placeholder="••••••"
                  placeholderTextColor="#775254"
                  value={token}
                  onChangeText={setToken}
                />
                <View className="mt-4">
                  <GradientButton
                    label="Verify"
                    onPress={() => void verifyCode()}
                    loading={busy}
                    disabled={token.trim().length !== 6}
                  />
                </View>
                <Pressable onPress={() => setStep('phone')} className="mt-3 items-center">
                  <Text className="text-xs text-muted-foreground">Change number</Text>
                </Pressable>
              </>
            )}
            {error ? (
              <View className="mt-4 rounded-lg bg-destructive/10 px-3 py-2">
                <Text className="text-xs text-destructive">{error}</Text>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
