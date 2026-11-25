import type { ReactNode } from "react";
import { Alert, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Row } from "@/components/row";
import { Screen } from "@/components/screen";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { signOut, useMyProfile, useSession, type Profile } from "@/features/auth";
import { CONTRACT, updateId, variant } from "@/lib/build";
import { useErrorCopy } from "@/lib/error-copy";

export type MeState =
  | { kind: "anonymous" }
  | { kind: "loading" }
  | { kind: "error"; message: string; offline: boolean; requestId: string | null }
  | { kind: "profile"; profile: Profile; lastUpdated: number | null };

/** Me: who I am, and the way out. Its pages arrive with step 5. Signed out,
 *  the tab is Sign: `signIn` fills it. */
export function MeScreen({
  signIn,
  onProfile,
  onClass,
  onNotifications,
  onSettings,
  onDelete,
}: {
  signIn: ReactNode;
  onProfile: () => void;
  onClass: () => void;
  onNotifications: () => void;
  onSettings: () => void;
  onDelete: () => void;
}) {
  const member = useSession().guestId !== null;
  const profile = useMyProfile();
  const copy = useErrorCopy(profile.error);

  const state = (): MeState => {
    if (!member) return { kind: "anonymous" };
    const paused = profile.fetchStatus === "paused";
    if (profile.data) {
      const lastUpdated = profile.isError || paused ? profile.dataUpdatedAt : null;
      return { kind: "profile", profile: profile.data, lastUpdated };
    }
    if (paused) return { kind: "error", message: "", offline: true, requestId: null };
    return profile.isError ? { kind: "error", ...copy } : { kind: "loading" };
  };

  const askSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <MeView
      state={state()}
      signIn={signIn}
      onRetry={() => void profile.refetch()}
      onSignOut={askSignOut}
      onProfile={onProfile}
      onClass={onClass}
      onNotifications={onNotifications}
      onSettings={onSettings}
      onDelete={onDelete}
    />
  );
}

type ViewProps = {
  state: MeState;
  signIn: ReactNode;
  onRetry: () => void;
  onSignOut: () => void;
  onProfile?: () => void;
  onClass?: () => void;
  onNotifications?: () => void;
  onSettings?: () => void;
  onDelete?: () => void;
};

const clock = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function MeView({ state, signIn, onRetry, onSignOut, onProfile, onClass, onNotifications, onSettings, onDelete }: ViewProps) {
  if (state.kind === "anonymous") {
    return signIn;
  }
  return (
    <Screen>
      {state.kind === "loading" ? <Skeleton style={styles.loading} /> : null}
      {state.kind === "error" ? (
        <ErrorState message={state.message} offline={state.offline} requestId={state.requestId} onRetry={onRetry} />
      ) : null}
      {state.kind === "profile" ? (
        <Card>
          <Text role="title">{[state.profile.firstName, state.profile.lastName].filter(Boolean).join(" ")}</Text>
          <Row label="Phone" value={state.profile.phone ?? undefined} />
          <Row label="Class" value={state.profile.isVip ? "VIP" : "Regular"} />
          {state.lastUpdated ? (
            <Text role="caption" tone="muted">{`Last updated ${clock(state.lastUpdated)}`}</Text>
          ) : null}
        </Card>
      ) : null}
      <Button kind="secondary" label="Sign out" onPress={onSignOut} testID="sign-out" />
      {state.kind === "profile" ? (
        <Card>
          <Row label="Profile" onPress={onProfile} />
          <Row label="Your class" onPress={onClass} />
          <Row label="Notifications" onPress={onNotifications} />
          <Row label="Settings" onPress={onSettings} />
          <Row label="Delete account" onPress={onDelete} />
        </Card>
      ) : null}
      <Text role="caption" tone="muted" selectable>{`${variant} · ${updateId} · contract ${CONTRACT}`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ loading: { height: 120 } });
