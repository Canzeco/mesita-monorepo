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

// Phone OTP with country dial picker — web PhoneInputWithCountry parity.

const OTP_LENGTH = 6;

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
  const codeOk = token.trim().length === OTP_LENGTH;

  const requestOtp = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  };

  const sendCode = async () => {
    if (await requestOtp()) {
      setStep('code');
    }
  };

  // "Resend code" re-calls signInWithOtp without leaving the code step, then
  // confirms inline (web PhoneOtpForm parity).
  const resendCode = async () => {
    if (await requestOtp()) {
      setInfo('We sent you a new code.');
    }
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
      <HeroBackdrop />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
        >
          <View style={{ marginBottom: 40, alignItems: 'center' }}>
            <Text
              className="font-display text-foreground"
              style={{ fontSize: 36, letterSpacing: -0.54 }}
            >
              Mesita
            </Text>
            <Text
              className="text-muted-foreground"
              style={{ marginTop: 12, textAlign: 'center', color: '#775254' }}
            >
              Tu mesa favorita te está esperando
            </Text>
          </View>

          <View
            className="rounded-2xl border border-border bg-card"
            style={{
              padding: 24,
              shadowColor: '#260409',
              shadowOpacity: 0.08,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 2,
            }}
          >
            {step === 'phone' ? (
              <>
                <Text
                  className="font-semibold text-muted-foreground"
                  style={{
                    marginBottom: 8,
                    color: '#775254',
                    letterSpacing: 1.2,
                  }}
                >
                  PHONE NUMBER
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    borderWidth: 1,
                    borderColor: '#ebd9db',
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <Pressable
                    onPress={() => setPickerOpen(true)}
                    accessibilityLabel="Country dial code"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      borderRightWidth: 1,
                      borderRightColor: '#ebd9db',
                    }}
                  >
                    <Text style={{ fontSize: 16 }}>{country.flag}</Text>
                    <Text className="font-semibold text-foreground">
                      +{country.dial}
                    </Text>
                    <ChevronDown color="#775254" size={12} />
                  </Pressable>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      color: '#260409',
                      paddingHorizontal: 12,
                      fontSize: 15,
                    }}
                    placeholderTextColor="#77525499"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholder="55 1234 5678"
                    value={localNumber}
                    onChangeText={setLocalNumber}
                  />
                </View>
                <Text
                  className="text-muted-foreground"
                  style={{ marginTop: 10, fontSize: 11, lineHeight: 15 }}
                >
                  We&apos;ll text you a 6-digit code. Standard SMS rates may
                  apply.
                </Text>
                <View style={{ marginTop: 16 }}>
                  <Button
                    onPress={() => void sendCode()}
                    loading={busy}
                    disabled={!phoneOk || busy}
                  >
                    Send code
                  </Button>
                </View>
              </>
            ) : (
              <>
                <Text
                  className="font-semibold text-muted-foreground"
                  style={{
                    marginBottom: 8,
                    color: '#775254',
                    letterSpacing: 1.2,
                  }}
                >
                  CODE SENT TO {e164}
                </Text>
                <TextInput
                  className="rounded-2xl border border-border bg-card px-3.5 py-3.5 text-foreground"
                  style={{
                    textAlign: 'center',
                    letterSpacing: 8,
                    fontSize: 24,
                  }}
                  placeholderTextColor="#77525499"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  maxLength={OTP_LENGTH}
                  placeholder="••••••"
                  value={token}
                  onChangeText={setToken}
                />
                <View style={{ marginTop: 16 }}>
                  <Button
                    onPress={() => void verifyCode()}
                    loading={busy}
                    disabled={!codeOk || busy}
                  >
                    Verify
                  </Button>
                </View>
                <Pressable
                  onPress={() => void resendCode()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Resend code"
                  style={{
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Text
                    className="font-semibold text-muted-foreground"
                    style={{ fontSize: 12 }}
                  >
                    Didn&apos;t get it? Resend code
                  </Text>
                </Pressable>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setStep('phone');
                    setInfo(null);
                    setError(null);
                  }}
                >
                  Change number
                </Button>
              </>
            )}
            {info ? (
              <Text
                className="mt-2 text-muted-foreground"
                style={{ fontSize: 12 }}
              >
                {info}
              </Text>
            ) : null}
            {error ? (
              <Text className="mt-2 text-destructive" style={{ fontSize: 12 }}>
                {error}
              </Text>
            ) : null}
          </View>

          <Text
            className="text-muted-foreground"
            style={{
              marginTop: 24,
              textAlign: 'center',
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            By continuing you agree to Mesita&apos;s terms of service and
            privacy policy.
          </Text>
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
