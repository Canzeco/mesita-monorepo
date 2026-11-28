import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Host, Picker } from "@expo/ui";

import { Button } from "@/components/button";
import { Field, FieldError } from "@/components/field";
import { Icon } from "@/components/icon";
import { Text } from "@/components/text";
import { setMyProfile, useMyProfile } from "@/features/auth";
import { useErrorCopy } from "@/lib/error-copy";
import { isOutcomeUnknown } from "@/lib/reconcile";
import { colors, pressedStyle, radius, space } from "@/theme";

import { saveSocialLevel } from "../api";
import { birthYears, checkDraft, draftOf, SEXES, type Draft } from "../model";
import { useSaveDetails } from "../queries";

const LEVELS = [
  { level: "private" as const, title: "Private", sub: "Other guests never see you or your activity, and you don't see theirs." },
  { level: "public" as const, title: "Public", sub: "Your activity shows with your first name, age and sex. You see everyone's activity." },
];

/** First name, last name, sex, and year of birth. The same fields as the web. */
export function ProfileScreen() {
  const profile = useMyProfile().data;
  const [typed, setTyped] = useState<Partial<Draft>>({});
  const [savedUntil, setSavedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const save = useSaveDetails();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const privacy = useMutation({
    mutationFn: saveSocialLevel,
    onSuccess: (next) => setMyProfile(next),
  });
  const copy = useErrorCopy(save.error);
  const draft: Draft = { ...draftOf(profile), ...typed };
  const set = (key: keyof Draft) => (value: string) => setTyped((current) => ({ ...current, [key]: value }));
  const { details, errors } = checkDraft(draft);
  const dirty = Object.keys(typed).length > 0;
  useEffect(() => {
    if (savedUntil <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), savedUntil - Date.now());
    return () => clearTimeout(timer);
  }, [savedUntil]);
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
              <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => set("sex")(value)} style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && pressedStyle]}>
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
          <Icon strokeWidth={2.25} name="chevron-down" size={16} color={colors.muted} />
          <View style={styles.picker}>
            <Host style={styles.host} colorScheme="light" seedColor={colors.ink}>
              <Picker selectedValue={draft.birthYear} onValueChange={set("birthYear")} accessibilityLabel="Year of birth">
                <Picker.Item label="Year" value="" />
                {birthYears().map((year) => <Picker.Item key={year} label={year} value={year} />)}
              </Picker>
            </Host>
          </View>
        </View>
        <Text role="note" tone="muted">{"It confirms you're old enough for Mesita. On a public profile, guests see your age."}</Text>
        {errors?.birthYear ? <FieldError>{errors.birthYear}</FieldError> : null}
      </View>
      {profile?.socialLevel ? (
        <Pressable accessibilityRole="button" onPress={() => setPrivacyOpen(true)} style={styles.privacy}>
          <Text role="tag" tone="muted">Privacy</Text>
          <Text role="label">{LEVELS.find((row) => row.level === (privacy.isPending ? privacy.variables : profile.socialLevel))?.title}</Text>
        </Pressable>
      ) : null}
      <Modal visible={privacyOpen} animationType="slide" onRequestClose={() => setPrivacyOpen(false)}>
        <View style={styles.sheet}>
          <Text role="title">Privacy</Text>
          {profile?.socialLock ? (
            <Text role="body" tone="muted">
              {profile.socialLock === "minor"
                ? "Profiles of guests under 18 are always private and don't see Social. This can't be changed."
                : "Save your year of birth to choose who sees you and to see Social."}
            </Text>
          ) : LEVELS.map((row) => (
            <Pressable
              key={row.level}
              accessibilityRole="radio"
              accessibilityState={{ checked: profile?.socialLevel === row.level }}
              onPress={() => {
                setPrivacyOpen(false);
                if (row.level !== profile?.socialLevel) privacy.mutate(row.level);
              }}
            >
              <Text role="label">{row.title}</Text>
              <Text role="small" tone="muted">{row.sub}</Text>
            </Pressable>
          ))}
          <Button label="Close" kind="secondary" onPress={() => setPrivacyOpen(false)} />
        </View>
      </Modal>
      {save.error ? (
        <FieldError>{isOutcomeUnknown(save.error) ? "We could not confirm this was saved. Try again." : copy.offline ? "No connection." : copy.message}</FieldError>
      ) : null}
      <Button
        label={save.isPending ? "Saving…" : now < savedUntil && !dirty ? "Saved" : "Save"}
        onPress={() =>
          details &&
          save.mutate(details, {
            onSuccess: () => {
              setTyped({});
              setSavedUntil(Date.now() + 2000);
            },
          })
        }
        busy={save.isPending}
        disabled={!details}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.lg },
  field: { gap: space.xs },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.xl, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.ink },
  year: { minHeight: 44, borderRadius: radius.xl, backgroundColor: colors.paper, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  picker: { ...StyleSheet.absoluteFill, overflow: "hidden", opacity: 0.02 },
  host: { flex: 1 },
  privacy: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheet: { flex: 1, backgroundColor: colors.paper, padding: space.lg, gap: space.md },
});
