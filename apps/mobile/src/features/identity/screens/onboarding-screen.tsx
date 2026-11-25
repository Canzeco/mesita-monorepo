import { Host, Picker } from "@expo/ui";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Field, FieldError } from "@/components/field";
import { Icon } from "@/components/icon";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { signOut, useMyProfile } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { isOutcomeUnknown } from "@/lib/reconcile";
import { colors, pressedOpacity, radius, space } from "@/theme";

import { birthYears, checkDraft, draftOf, SEXES, type Draft } from "../model";
import { useSaveDetails } from "../queries";

export function OnboardingScreen() {
  const profile = useMyProfile().data;
  // Typing wins over a profile that arrives late; a failed save keeps it all.
  const [typed, setTyped] = useState<Partial<Draft>>({});
  const save = useSaveDetails();
  const copy = useErrorCopy(save.error);
  const draft: Draft = { ...draftOf(profile), ...typed };
  const set = (key: keyof Draft) => (value: string) => setTyped((t) => ({ ...t, [key]: value }));
  const { details } = checkDraft(draft);

  const submit = () => {
    if (details) save.mutate(details);
  };

  return (
    <Screen
      footer={
        <Button label="Continue" onPress={submit} busy={save.isPending} disabled={!details} testID="save-details" />
      }
    >
      <View>
        <Text role="title">Almost there.</Text>
        <Text role="small" tone="muted" style={styles.dek}>
          {"A few quick details and you're in."}
        </Text>
      </View>
      <View style={styles.fields}>
        <Field
          label="First name"
          value={draft.firstName}
          onChangeText={set("firstName")}
          placeholder="e.g. Ana"
          maxLength={60}
          textContentType="givenName"
          autoComplete="given-name"
          autoCapitalize="words"
          testID="first-name"
        />
        <Field
          label="Last name"
          value={draft.lastName}
          onChangeText={set("lastName")}
          placeholder="e.g. García"
          maxLength={60}
          textContentType="familyName"
          autoComplete="family-name"
          autoCapitalize="words"
          testID="last-name"
        />
        <View style={styles.field}>
          <Text role="tag" tone="muted">
            Sex
          </Text>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Sex">
            {SEXES.map(({ value, label }) => {
              const on = draft.sex === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                  onPress={() => set("sex")(value)}
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: pressedOpacity }]}
                >
                  <Text role="label" tone={on ? "onInk" : "ink"}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.field}>
          <Text role="tag" tone="muted">
            Year of birth
          </Text>
          <View style={styles.year}>
            <Text role="small" tone={draft.birthYear ? "ink" : "muted"} style={styles.yearText}>
              {draft.birthYear || "Year"}
            </Text>
            <Icon name="chevron-down" size={16} color={colors.muted} />
            {/* The system's own list, opened by a tap anywhere on the field. */}
            <View style={styles.picker} testID="birth-year">
              <Host style={styles.host} colorScheme="light" seedColor={colors.ink}>
                <Picker selectedValue={draft.birthYear} onValueChange={set("birthYear")} accessibilityLabel="Year of birth">
                  <Picker.Item label="Year" value="" />
                  {birthYears().map((year) => (
                    <Picker.Item key={year} label={year} value={year} />
                  ))}
                </Picker>
              </Host>
            </View>
          </View>
          <Text role="note" tone="muted" style={styles.hint}>
            {"It confirms you're old enough for Mesita. On a public profile, guests see your age."}
          </Text>
        </View>
      </View>
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

const styles = StyleSheet.create({
  dek: { marginTop: 8 },
  fields: { marginTop: space.lg, gap: space.xl },
  field: { gap: 4 },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  chipOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  year: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  yearText: { flex: 1 },
  picker: { ...StyleSheet.absoluteFill, overflow: "hidden", opacity: 0.02 },
  host: { flex: 1 },
  hint: { marginTop: 8 },
});
