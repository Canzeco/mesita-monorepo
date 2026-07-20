import { ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountryCodePicker } from '@/components/auth/CountryCodePicker';
import { Button } from '@/components/ui/Button';
import { HeroBackdrop } from '@/components/ui/HeroBackdrop';
import { apiConsumerSigninPhone } from '@/lib/api/auth';
import {
  combinePhoneE164,
  COUNTRY_BY_CODE,
  type Country,
} from '@/lib/countries';
import { supabase } from '@/lib/supabase';

// Phone OTP with country dial picker — web PhoneOtpForm parity (#47).
// No guest entry. Post-verify EF then gate routes onboard vs home.

export default function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [countryCode, setCountryCode] = useState('MX');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localNumber, setLocalNumber] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const country: Country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;
  const e164 = useMemo(
    () => combinePhoneE164(countryCode, localNumber),
    [countryCode, localNumber],
  );
  const phoneOk = localNumber.replace(/\D/g, '').length >= 8;
  const codeOk = token.trim().length === 6;

  const sendCode = async () => {
    setError(null);
    setInfo(null);
    if (!localNumber.trim()) {
      setError('Enter your phone number.');
      return;
    }
    if (!phoneOk) {
      setError('Enter a valid phone number.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep('code');
    setInfo('We just sent you a 6-digit code.');
  };

  const verifyCode = async () => {
    setError(null);
    setInfo(null);
    const cleaned = token.replace(/\D/g, '');
    if (cleaned.length !== 6) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: e164,
      token: cleaned,
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
    <View className="flex-1 bg-background">
      <HeroBackdrop />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center px-6"
        >
          <View className="mb-10 items-center">
            <Text className="font-display text-[36px] tracking-tight text-foreground">
              Mesita
            </Text>
            <Text className="mt-3 text-center text-muted-foreground">
              Sign in with your phone
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {step === 'phone' ? (
              <>
                <Text className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Phone number
                </Text>
                <View className="flex-row items-stretch overflow-hidden rounded-xl border border-border bg-card">
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    accessibilityLabel="Country dial code"
                    className="flex-row items-center gap-1.5 border-r border-border px-3"
                  >
                    <Text className="text-base">{country.flag}</Text>
                    <Text className="font-semibold text-foreground">
                      +{country.dial}
                    </Text>
                    <ChevronDown color="#775254" size={12} />
                  </Pressable>
                  <TextInput
                    className="flex-1 px-3 text-[15px] text-foreground"
                    placeholderTextColor="#77525499"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="55 1234 5678"
                    value={localNumber}
                    onChangeText={setLocalNumber}
                  />
                </View>
                <Text className="mt-2 text-[11px] text-muted-foreground">
                  We&apos;ll text you a 6-digit code. Standard SMS rates may
                  apply.
                </Text>
                {error ? (
                  <View className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
                    <Text className="text-xs text-destructive">{error}</Text>
                  </View>
                ) : null}
                <View className="mt-4">
                  <Button
                    onPress={() => void sendCode()}
                    loading={busy}
                    disabled={!localNumber.trim() || busy}
                  >
                    Send code
                  </Button>
                </View>
              </>
            ) : (
              <>
                <View className="mb-3 flex-row items-center justify-between">
                  <Pressable
                    onPress={() => {
                      setStep('phone');
                      setToken('');
                      setError(null);
                      setInfo(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Change number"
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">
                      ← Change number
                    </Text>
                  </Pressable>
                  <Text className="text-xs text-muted-foreground">{e164}</Text>
                </View>
                <Text className="mb-1.5 text-xs font-medium text-muted-foreground">
                  6-digit code
                </Text>
                <TextInput
                  className="rounded-2xl border border-border bg-card px-3.5 py-3.5 text-center text-lg tracking-[0.5em] text-foreground"
                  placeholderTextColor="#77525499"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={6}
                  placeholder="123456"
                  value={token}
                  onChangeText={(t) => setToken(t.replace(/\D/g, ''))}
                />
                {info ? (
                  <View className="mt-2 rounded-xl border border-sky-400/30 bg-sky-50 px-3 py-2">
                    <Text className="text-xs text-sky-900">{info}</Text>
                  </View>
                ) : null}
                {error ? (
                  <View className="mt-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
                    <Text className="text-xs text-destructive">{error}</Text>
                  </View>
                ) : null}
                <View className="mt-4">
                  <Button
                    onPress={() => void verifyCode()}
                    loading={busy}
                    disabled={!codeOk || busy}
                  >
                    Verify
                  </Button>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CountryCodePicker
        visible={pickerOpen}
        countryCode={countryCode}
        onClose={() => setPickerOpen(false)}
        onSelect={setCountryCode}
      />
    </View>
  );
}
