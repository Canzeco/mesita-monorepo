import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BirthdayPicker } from '@/components/ui/BirthdayPicker';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { COLORS } from '@/constants/brand';
import { apiUpdateConsumerProfile } from '@/lib/api/auth';
import { ageFromBirthday, MIN_SIGNUP_AGE } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

// Mirrors web's CONSUMER_SEXES (lib/consumer-onboarding.ts). Hand-copied
// rather than imported: the packages are independent install roots with no
// shared module, which is the same reason isOnboarded is hand-mirrored.
const SEXES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

// ONE QUESTION PER SCREEN (MESITA-1830) — the hand-mirror of web's
// ONBOARD_STEPS in apps/web-consumer/src/lib/consumer-onboarding.ts. Same
// three keys, same order, same headlines; web/mobile IA cannot diverge, and
// the drift alarm greps THIS FILE for these three headline strings
// (apps/web-consumer/src/lib/__tests__/onboarding-gate.test.ts).
//
// The age is interpolated from MIN_SIGNUP_AGE, never typed — it has moved
// once already (MESITA-727) and a literal here would rot silently.
const STEPS = [
  {
    key: 'first_name',
    headline: 'What should we call you?',
    dek: 'The app greets you by it.',
  },
  {
    key: 'birthday',
    headline: "When's your birthday?",
    dek: `We check you're ${MIN_SIGNUP_AGE} or over, and we'll remember it.`,
  },
  { key: 'sex', headline: 'Last one.', dek: null },
] as const;

export default function Onboard() {
  const router = useRouter();
  const { profile, refreshProfile, signOut, session, onboarded } = useAuth();
  // THREE fields, mirroring web's OnboardForm (MESITA-1829): first name,
  // birthday, sex. Sex is REQUIRED here as it is on web — the Passport
  // document prints `age · sex · country` and nothing else collects it. Last
  // name is still asked by the reservation flow instead, where the guest can
  // see why the place needs it.
  //
  // Prefilled so a half-onboarded consumer fills the one missing field, and
  // the flow OPENS on that field rather than at the top (MESITA-1830). That
  // resume is real, not cosmetic: each step writes as it is answered, because
  // consumer-web-update-profile patches only the keys a request carries.
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [sex, setSex] = useState<'male' | 'female' | ''>(
    profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : '',
  );
  const [step, setStep] = useState(() => {
    if (!profile?.first_name) return 0;
    if (!profile?.birthday) return 1;
    return 2;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Android's hardware Back steps DOWN the flow instead of leaving it, so it
  // matches the chevron. Returning false at step 0 hands the press back to the
  // OS — there is nothing before the first question, and "Not you?" is the
  // real exit. Registered before the `onboarded` early return so the hook
  // order never changes between renders.
  //
  // The same effect ANNOUNCES the new question. Nothing navigates here — the
  // screen stays mounted and swaps its headline — so VoiceOver/TalkBack say
  // nothing at all when the step changes, leaving a guest who cannot see the
  // dots with a field for a question they were never read. The headline IS
  // the question, so reading it reads the screen. (Web does this by moving
  // focus to the <h1>; RN has no focusable heading, so it speaks instead.)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setError(null);
      setStep((s) => Math.max(0, s - 1));
      return true;
    });
    AccessibilityInfo.announceForAccessibility(STEPS[step].headline);
    return () => sub.remove();
  }, [step]);

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  const validBirthday = /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim());
  // Age gate — 13 or below is restricted (MESITA-727).
  const age = ageFromBirthday(birthday.trim());
  const underage = age !== null && age < MIN_SIGNUP_AGE;
  // Only the CURRENT question gates the button; the others are already
  // written or not yet asked.
  const canSubmit =
    current.key === 'first_name'
      ? firstName.trim().length > 0
      : current.key === 'birthday'
        ? validBirthday && !underage
        : sex !== '';

  const phoneLabel = session?.user.phone ? `+${session.user.phone}` : null;

  if (onboarded) {
    return <Redirect href="/(tabs)/home" />;
  }

  const submit = async () => {
    // The step this write belongs to, read now rather than when it resolves —
    // the mirror of web's `stepAfterSave` (lib/consumer-onboarding.ts). Back
    // stays live during a save, and on Android the hardware Back cannot be
    // disabled at all, so "Continue, then Back" used to undo itself: the
    // resolve ran `s + 1` against whatever step the guest had moved to. The
    // field is still saved; only the advance is withdrawn.
    const from = step;
    setError(null);
    setBusy(true);
    try {
      if (current.key === 'first_name') {
        await apiUpdateConsumerProfile({ first_name: firstName.trim() });
      } else if (current.key === 'birthday') {
        await apiUpdateConsumerProfile({ birthday: birthday.trim() });
      } else if (sex === 'male' || sex === 'female') {
        await apiUpdateConsumerProfile({ sex });
      }
      if (last) {
        // Only the final write completes the gate, so this is the only place
        // the provider's `onboarded` can flip — refreshing earlier would cost
        // a round trip that cannot change anything.
        await refreshProfile();
        router.replace('/');
        return;
      }
      setStep((s) => (s === from ? s + 1 : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Step bar — the mirror of web's OnboardStepBar. The dots are ONE
          control (a progressbar reading "Step 2 of 3"), not three announced
          elements, and the right-hand spacer keeps them from shifting
          sideways when the chevron appears at step 2. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        <View style={{ width: 44, alignItems: 'flex-start' }}>
          {step > 0 ? (
            <Pressable
              onPress={() => {
                setError(null);
                setStep((s) => Math.max(0, s - 1));
              }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={{
                minHeight: 44,
                width: 44,
                justifyContent: 'center',
              }}
            >
              <ChevronLeft color={COLORS.foreground} size={22} />
            </Pressable>
          ) : null}
        </View>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          {STEPS.map((s, i) => (
            <View
              key={s.key}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className={i <= step ? 'bg-foreground' : 'bg-border'}
              style={{ height: 6, width: i === step ? 20 : 6, borderRadius: 3 }}
            />
          ))}
        </View>

        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 16 }}
      >
        {/* No card wrapper (design review, defect 4 — web closed it in
            MESITA-1829, mobile closes it here). A bordered, shadowed box
            around the only question on the screen framed it as a form to be
            processed rather than a door to be walked through. */}
        <View style={{ flex: 1, paddingTop: 24 }}>
          <Text
            accessibilityRole="header"
            className="font-display font-semibold text-foreground"
            style={{ fontSize: 28, letterSpacing: -0.42 }}
          >
            {current.headline}
          </Text>
          {current.dek ? (
            <Text className="mt-2 text-muted-foreground" style={{ fontSize: 14 }}>
              {current.dek}
            </Text>
          ) : null}

          <View style={{ marginTop: 32 }}>
            {current.key === 'first_name' ? (
              <TextField
                accessibilityLabel={current.headline}
                autoComplete="given-name"
                autoCapitalize="words"
                autoFocus
                maxLength={60}
                value={firstName}
                onChangeText={(v) => {
                  setFirstName(v);
                  setError(null);
                }}
              />
            ) : null}

            {current.key === 'birthday' ? (
              <>
                <BirthdayPicker
                  value={birthday}
                  onChange={(v) => {
                    setBirthday(v);
                    setError(null);
                  }}
                />
                {underage ? (
                  <Text className="mt-3 text-destructive" style={{ fontSize: 12 }}>
                    You must be at least {MIN_SIGNUP_AGE} to use Mesita.
                  </Text>
                ) : (
                  <Text
                    className="mt-3 text-muted-foreground"
                    style={{ fontSize: 12, lineHeight: 16 }}
                  >
                    Nobody sees it. It sets the age on your Passport.
                  </Text>
                )}
              </>
            ) : null}

            {/* Two options and no third: `consumers_sex_check` allows male and
                female only (narrowed by 20260825003000), so this list is the
                whole vocabulary. radiogroup rather than two buttons so
                TalkBack/VoiceOver announce it as one exclusive choice — and it
                carries its own label, because the visible heading now says
                "Last one." rather than naming the question. */}
            {current.key === 'sex' ? (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Sex"
                style={{ flexDirection: 'row', gap: 8 }}
              >
                {SEXES.map((option) => {
                  const on = sex === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setSex(option.value);
                        setError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={option.label}
                      className={
                        on
                          ? 'flex-1 items-center justify-center rounded-full border border-foreground bg-foreground'
                          : 'flex-1 items-center justify-center rounded-full border border-border bg-card'
                      }
                      style={{ height: 44 }}
                    >
                      <Text
                        className={on ? 'text-background' : 'text-foreground'}
                        style={{ fontSize: 14, fontWeight: '600' }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          {error ? (
            <Text className="mt-4 text-destructive" style={{ fontSize: 12 }}>
              {error}
            </Text>
          ) : null}
        </View>

        {/* Bottom-anchored so the CTA does not move between step 1 and step 3
            — the one element whose job is to stay put. */}
        <Button
          onPress={() => void submit()}
          loading={busy}
          disabled={!canSubmit || busy}
        >
          Continue
        </Button>

        {/* Identity is a FOOTNOTE under the button (design review, defect 1 —
            web closed it in MESITA-1829, mobile closes it here). It used to
            own the top of the screen, putting account-recovery chrome above
            the only sentence that tells a guest what is happening. It is also
            the real exit from step 1, which is why no Back renders there. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 12,
          }}
        >
          <Text
            className="text-muted-foreground"
            style={{ fontSize: 12, flexShrink: 1 }}
            numberOfLines={1}
          >
            {phoneLabel ?? 'Your account'}
          </Text>
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Not you? Sign out"
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            {/* UNDERLINED (MESITA-1954). `text-primary` was brand pink, and
                the pink WAS the affordance: the one tappable thing in this row,
                against the muted phone label sitting 12px away from it.
                Achromatic, primary IS foreground, so the link would differ from
                a static label by font-weight alone — not an affordance at 12px,
                and this is the only exit from step 1 (see the note above). The
                rule that took the hue owes the shape back; DeleteAccountSheet
                already underlines its own inline link. */}
            <Text
              className="font-semibold text-primary"
              style={{ fontSize: 12, textDecorationLine: 'underline' }}
            >
              Not you?
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
