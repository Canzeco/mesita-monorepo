import { Alert, StyleSheet } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { ErrorState } from "@/components/error-state";
import { Row } from "@/components/row";
import { Screen } from "@/components/screen";
import { SignInInvite } from "@/components/sign-in-invite";
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

/** Me: who I am, and the way out. Its pages arrive with step 5. */
export function MeScreen({ onSignIn }: { onSignIn: () => void }) {
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

  return <MeView state={state()} onSignIn={onSignIn} onRetry={() => void profile.refetch()} onSignOut={askSignOut} />;
}

type ViewProps = { state: MeState; onSignIn: () => void; onRetry: () => void; onSignOut: () => void };

const clock = (at: number) => new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function MeView({ state, onSignIn, onRetry, onSignOut }: ViewProps) {
  if (state.kind === "anonymous") {
    return <SignInInvite message="Your reservations and your profile live here." onSignIn={onSignIn} />;
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
      <Text role="caption" tone="muted" selectable>{`${variant} · ${updateId} · contract ${CONTRACT}`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ loading: { height: 120 } });
