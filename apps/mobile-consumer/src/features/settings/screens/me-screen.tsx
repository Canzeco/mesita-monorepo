import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ErrorState } from "@/components/error-state";
import { Icon, type IconName } from "@/components/icon";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { useMyProfile, useSession, type Profile } from "@/features/auth";
import { listNotices } from "@/features/notifications";
import { listReservations } from "@/features/reservations";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, pressedOpacity, radius, space } from "@/theme";

export type MeState =
  | { kind: "anonymous" }
  | { kind: "loading" }
  | { kind: "error"; message: string; offline: boolean; requestId: string | null }
  | { kind: "profile"; profile: Profile; lastUpdated: number | null };

export type MeNav = {
  onProfile: () => void;
  onClass: () => void;
  onReservations: () => void;
  onNotifications: () => void;
  onTickets: () => void;
  onCard: () => void;
  onSaved: () => void;
  onPlan: () => void;
  onShare: () => void;
  onSettings: () => void;
};

const TILES: { key: keyof MeNav; label: string; icon: IconName }[] = [
  { key: "onProfile", label: "Profile", icon: "user" },
  { key: "onClass", label: "Class", icon: "crown" },
  { key: "onReservations", label: "Reservations", icon: "calendar" },
  { key: "onNotifications", label: "Notifications", icon: "bell" },
  { key: "onTickets", label: "Tickets", icon: "ticket" },
  { key: "onCard", label: "Card", icon: "card" },
  { key: "onSaved", label: "Saved", icon: "heart" },
  { key: "onPlan", label: "Plan", icon: "gem" },
  { key: "onShare", label: "Share", icon: "share-2" },
  { key: "onSettings", label: "Settings", icon: "settings" },
];

/** Me: the name and Class, then the web's ten cells. Signed out, the tab is Sign. */
export function MeScreen({ signIn, nav }: { signIn: ReactNode; nav: MeNav }) {
  const member = useSession().guestId !== null;
  const profile = useMyProfile();
  const copy = useErrorCopy(profile.error);
  const notices = useQuery({ queryKey: ["notices"], queryFn: ({ signal }) => listNotices(signal), enabled: member });
  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: ({ signal }) => listReservations(signal),
    enabled: member,
  });

  const state = (): MeState => {
    if (!member) return { kind: "anonymous" };
    if (profile.data) return { kind: "profile", profile: profile.data, lastUpdated: profile.isError ? profile.dataUpdatedAt : null };
    if (profile.fetchStatus === "paused") return { kind: "error", message: "", offline: true, requestId: null };
    return profile.isError ? { kind: "error", ...copy } : { kind: "loading" };
  };

  const upcoming = (reservations.data ?? []).filter((row) => row.state !== "cancelled" && row.state !== "completed").length;
  const badges: Partial<Record<keyof MeNav, number>> = {
    onNotifications: notices.data?.length ?? 0,
    onReservations: upcoming,
  };

  return <MeView state={state()} signIn={signIn} nav={nav} badges={badges} onRetry={() => void profile.refetch()} />;
}

export function MeView({
  state,
  signIn,
  nav,
  badges = {},
  onRetry,
}: {
  state: MeState;
  signIn: ReactNode;
  nav?: Partial<MeNav>;
  badges?: Partial<Record<keyof MeNav, number>>;
  onRetry?: () => void;
}) {
  if (state.kind === "anonymous") return signIn;
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {state.kind === "loading" ? <Skeleton style={styles.loading} /> : null}
      {state.kind === "error" ? (
        <ErrorState message={state.message} offline={state.offline} requestId={state.requestId} onRetry={onRetry ?? (() => undefined)} />
      ) : null}
      {state.kind === "profile" ? (
        <>
          <View style={styles.identity}>
            {state.profile.avatarUrl ? (
              <Image source={state.profile.avatarUrl} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatar} />
            )}
            <View style={styles.nameBar}>
              <Text role="strong">{state.profile.firstName?.trim() || state.profile.fullName?.trim() || "Mesita member"}</Text>
              <View style={styles.classPill}>
                <Text role="caption" tone="muted">{state.profile.isVip ? "VIP" : "Regular"}</Text>
              </View>
            </View>
          </View>
          <View style={styles.grid}>
            {TILES.map((tile) => (
              <Pressable
                key={tile.label}
                accessibilityRole="button"
                accessibilityLabel={tile.label}
                onPress={nav?.[tile.key]}
                style={({ pressed }) => [styles.tile, pressed && { opacity: pressedOpacity }]}
              >
                <View style={styles.chip}>
                  <Icon name={tile.icon} size={18} />
                </View>
                <Text role="label" numberOfLines={1} style={styles.tileLabel}>{tile.label}</Text>
                {(badges[tile.key] ?? 0) > 0 ? (
                  <View style={styles.badge}>
                    <Text role="caption" tone="onInk">{badges[tile.key]}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  loading: { height: 120 },
  identity: { alignItems: "center", gap: space.md },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.fill, overflow: "hidden" },
  nameBar: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: radius.control,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  classPill: { backgroundColor: colors.fill, borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "46%",
    minHeight: 56,
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
});
