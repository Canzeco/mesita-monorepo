import { Host, Picker } from "@expo/ui";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Field, FieldError } from "@/components/field";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { signOut, useMyProfile } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { isOutcomeUnknown } from "@/lib/reconcile";
import { space } from "@/theme";

import { checkDraft, draftOf, MIN_AGE, SEXES, type Draft, type DraftErrors } from "../model";
import { useSaveDetails } from "../queries";

export function OnboardingScreen() {
  const profile = useMyProfile().data;
  // Typing wins over a profile that arrives late; a failed save keeps it all.
  const [typed, setTyped] = useState<Partial<Draft>>({});
  const [errors, setErrors] = useState<DraftErrors>({});
  const save = useSaveDetails();
  const copy = useErrorCopy(save.error);
  const draft: Draft = { ...draftOf(profile), ...typed };
  const set = (key: keyof Draft) => (value: string) => setTyped((t) => ({ ...t, [key]: value }));

  const submit = () => {
    const checked = checkDraft(draft);
    setErrors(checked.errors ?? {});
    if (checked.details) save.mutate(checked.details);
  };

  return (
    <Screen footer={<Button label="Continue" onPress={submit} busy={save.isPending} testID="save-details" />}>
      <Field
        label="First name"
        value={draft.firstName}
        onChangeText={set("firstName")}
        textContentType="givenName"
        autoComplete="given-name"
        autoCapitalize="words"
        error={errors.firstName}
        testID="first-name"
      />
      <Field
        label="Last name"
        value={draft.lastName}
        onChangeText={set("lastName")}
        textContentType="familyName"
        autoComplete="family-name"
        autoCapitalize="words"
        error={errors.lastName}
        testID="last-name"
      />
      <View style={styles.field}>
        <Text role="label">Sex</Text>
        <Host matchContents>
          <Picker selectedValue={draft.sex} onValueChange={set("sex")} accessibilityLabel="Sex">
            <Picker.Item label="Choose" value="" />
            {SEXES.map((s) => (
              <Picker.Item key={s.value} label={s.label} value={s.value} />
            ))}
          </Picker>
        </Host>
        {errors.sex ? <FieldError>{errors.sex}</FieldError> : null}
      </View>
      <Field
        label="Year of birth"
        value={draft.birthYear}
        onChangeText={set("birthYear")}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="1995"
        error={errors.birthYear}
        testID="birth-year"
      />
      <Text role="caption" tone="muted">{`We check you're ${MIN_AGE} or over.`}</Text>
      {save.error ? (
        <FieldError>
          {isOutcomeUnknown(save.error)
            ? "We could not confirm this was saved. Try again."
            : copy.offline
              ? "No connection."
              : copy.message}
        </FieldError>
      ) : null}
      <Button kind="quiet" label="Sign out" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ field: { gap: space.sm, alignItems: "flex-start" } });
