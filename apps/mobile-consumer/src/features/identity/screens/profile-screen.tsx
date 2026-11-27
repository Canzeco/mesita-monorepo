import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Host, Picker } from "@expo/ui";

import { Button } from "@/components/button";
import { Field, FieldError } from "@/components/field";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { useMyProfile } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { isOutcomeUnknown } from "@/lib/reconcile";
import { colors, pressedOpacity, radius, space } from "@/theme";

import { birthYears, checkDraft, draftOf, SEXES, type Draft } from "../model";
import { useSaveDetails } from "../queries";

/** First name, last name, sex, and year of birth. The same fields as the web. */
export function ProfileScreen({ onSaved }: { onSaved: () => void }) {
  const profile = useMyProfile().data;
  const [typed, setTyped] = useState<Partial<Draft>>({});
  const save = useSaveDetails();
  const copy = useErrorCopy(save.error);
  const draft: Draft = { ...draftOf(profile), ...typed };
  const set = (key: keyof Draft) => (value: string) => setTyped((current) => ({ ...current, [key]: value }));
  const { details, errors } = checkDraft(draft);
  useEffect(() => {
    if (save.isSuccess) onSaved();
  }, [save.isSuccess, onSaved]);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Field label="First name" value={draft.firstName} onChangeText={set("firstName")} autoCapitalize="words" textContentType="givenName" />
      <Field label="Last name" value={draft.lastName} onChangeText={set("lastName")} autoCapitalize="words" textContentType="familyName" />
      <View style={styles.field}>
        <Text role="tag" tone="muted">Sex</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {SEXES.map(({ value, label }) => {
            const on = draft.sex === value;
            return (
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => set("sex")(value)} style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: pressedOpacity }]}>
                <Text role="label" tone={on ? "onInk" : "ink"}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors?.sex ? <FieldError>{errors.sex}</FieldError> : null}
      </View>
      <View style={styles.field}>
        <Text role="tag" tone="muted">Year of birth</Text>
        <View style={styles.year}>
          <Text role="small" tone={draft.birthYear ? "ink" : "muted"}>{draft.birthYear || "Year"}</Text>
          <Icon name="chevron-down" size={16} color={colors.muted} />
          <View style={styles.picker}>
            <Host style={styles.host} colorScheme="light" seedColor={colors.ink}>
              <Picker selectedValue={draft.birthYear} onValueChange={set("birthYear")} accessibilityLabel="Year of birth">
                <Picker.Item label="Year" value="" />
                {birthYears().map((year) => <Picker.Item key={year} label={year} value={year} />)}
              </Picker>
            </Host>
          </View>
        </View>
        <Text role="note" tone="muted">It confirms you're old enough for Mesita. On a public profile, guests see your age.</Text>
        {errors?.birthYear ? <FieldError>{errors.birthYear}</FieldError> : null}
      </View>
      {save.error ? (
        <FieldError>{isOutcomeUnknown(save.error) ? "We could not confirm this was saved. Try again." : copy.offline ? "No connection." : copy.message}</FieldError>
      ) : null}
      <Button label="Save" onPress={() => details && save.mutate(details)} busy={save.isPending} disabled={!details} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.lg },
  field: { gap: space.xs },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.field, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink },
  year: { minHeight: 44, borderRadius: radius.field, backgroundColor: colors.paper, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  picker: { ...StyleSheet.absoluteFillObject },
  host: { flex: 1, opacity: 0.02 },
});
