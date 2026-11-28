import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Text } from "@/components/text";
import { rereadMyProfile, useMyProfile, useSession } from "@/features/auth";
import { EdgeError } from "@/lib/edge";
import { colors, radius, space } from "@/theme";

import { disconnectInstagram, instagramChannel, instagramDmStatus, instagramVipLine, setInstagramHandle, startInstagramDm, type InstagramClaim } from "../hub";

const RULE = "Have a public Instagram with more than 5,000 followers? Verify it and you're in.";

/** Upgrade with Instagram: save the handle, then one DM proves it. */
export function InstagramScreen() {
  const guestId = useSession().guestId;
  const profile = useMyProfile().data;
  const current = profile?.instagramHandle ?? null;
  const vip = profile?.isVip === true;
  const proved = profile?.instagramProvedAt != null;
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [claim, setClaim] = useState<InstagramClaim | null>(null);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<"wrong_account" | "expired" | "failed" | null>(null);
  const channel = useQuery({
    queryKey: ["instagram-channel"],
    queryFn: ({ signal }) => instagramChannel(signal),
    enabled: current != null && !editing,
  });

  useEffect(() => {
    if (!claim || !sent || !guestId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const status = await instagramDmStatus();
        if (cancelled) return;
        if (status.status === "none" && status.handle === claim.handle && status.provedAt) {
          setClaim(null);
          setSent(false);
          setSaid(`@${claim.handle} is verified`);
          await rereadMyProfile(guestId);
          return;
        }
        if (status.status === "expired" || status.status === "none") {
          setClaim(null);
          setSent(false);
          setProblem("expired");
          return;
        }
        setProblem(status.status === "wrong_account" ? "wrong_account" : null);
      } catch {
        // The next tick tries the read again.
      }
      if (!cancelled) timer = setTimeout(() => void tick(), 3000);
    };
    timer = setTimeout(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [claim, sent, guestId]);

  const save = () => {
    const trimmed = handle.trim().replace(/^@/, "");
    if (!trimmed || busy) return;
    setBusy(true);
    setSaid(null);
    void setInstagramHandle(trimmed)
      .then(async () => {
        if (guestId) await rereadMyProfile(guestId);
        setEditing(false);
        setHandle("");
      })
      .catch(() => setSaid("Couldn't save. Try again."))
      .finally(() => setBusy(false));
  };

  const start = (vipCheck: boolean) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    void startInstagramDm(vipCheck)
      .then((next) => {
        setClaim(next);
        setSent(false);
        setAsking(false);
      })
      .catch((err: unknown) => {
        const name = err instanceof EdgeError ? err.code : "";
        setSaid(name === "dm_unavailable" ? "Verifying by DM is off right now. The handle is saved." : null);
        setProblem("failed");
      })
      .finally(() => setBusy(false));
  };

  const remove = () => {
    if (!current) return;
    Alert.alert(`Remove @${current}?`, "Its verification goes, and so does VIP if your Instagram gave it. A picture that came from Instagram goes too.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void disconnectInstagram()
            .then(async () => {
              if (guestId) await rereadMyProfile(guestId);
              setEditing(false);
              setClaim(null);
            })
            .catch(() => setSaid("Couldn't remove it. Try again."));
        },
      },
    ]);
  };

  if (!current || editing) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <Text role="strong">{current ? "Your Instagram" : "Verify your Instagram"}</Text>
        {current ? null : <Text role="small" tone="muted">{RULE}</Text>}
        <Field label="Handle" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} />
        {current ? <Text role="caption" tone="muted">{`A new handle starts Unverified. @${current} is removed.`}</Text> : null}
        {said ? <Text role="small">{said}</Text> : null}
        <Button label={busy ? "Saving…" : current ? "Save" : "Continue"} busy={busy} disabled={handle.trim().length < 1} onPress={save} />
        {current ? (
          <View style={styles.pair}>
            <Button label="Cancel" kind="quiet" onPress={() => setEditing(false)} />
            <Button label="Remove" kind="danger" onPress={remove} />
          </View>
        ) : null}
        <Text role="caption" tone="muted">We never ask for your Instagram password.</Text>
      </ScrollView>
    );
  }

  const line = proved ? instagramVipLine(profile?.instagramVipStatus ?? null, profile?.instagramFollowers ?? null) : null;
  const live = channel.data?.channel === "dm";
  const canStart = !proved || !vip;
  const problemLine =
    problem === "wrong_account"
      ? `That message came from a different account. Send the code from @${current}, or edit your handle.`
      : problem === "expired"
        ? "That code expired. Get a new one to try again."
        : problem === "failed"
          ? "Couldn't get a code. Try again."
          : null;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text role="strong">{vip ? "Your Instagram" : "Verify your Instagram"}</Text>
      {vip ? null : <Text role="small" tone="muted">{RULE}</Text>}
      <View style={styles.handleRow}>
        <Text role="label" style={styles.handle}>{`@${current}`}</Text>
        {proved ? <Text role="label">Verified</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => setEditing(true)}>
          <Text role="label" tone="muted">Edit</Text>
        </Pressable>
      </View>
      {line ? <Text role="small">{line}</Text> : null}
      {claim ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Your code ${claim.code}, tap to copy`}
            onPress={() => {
              setSent(true);
              void Share.share({ message: claim.code }).catch(() => setSaid("Couldn't copy. Type it in instead."));
            }}
            style={styles.code}
          >
            <Text role="title">{claim.code}</Text>
          </Pressable>
          <Text role="caption" tone="muted">{`Paste it in a message to @${claim.account}, from @${claim.handle}. It works once and lasts 15 minutes.`}</Text>
          <Button
            label="Send my code on Instagram"
            onPress={() => {
              setSent(true);
              if (claim.link) void Linking.openURL(claim.link);
            }}
          />
          {sent && problem !== "wrong_account" ? <Text role="caption" tone="muted">Waiting for your message…</Text> : null}
        </>
      ) : asking ? (
        <View style={styles.ask}>
          <Text role="label">Allow Mesita to check your Instagram follower count for VIP?</Text>
          <View style={styles.pair}>
            <Button label="Allow" busy={busy} onPress={() => start(true)} />
            <Button label="Not now" kind="quiet" onPress={() => setAsking(false)} />
          </View>
        </View>
      ) : canStart && live ? (
        <Button label={proved ? "Check again" : "Verify"} busy={busy} onPress={() => (vip ? start(false) : setAsking(true))} />
      ) : canStart && channel.data?.channel === "off" && !proved ? (
        <Text role="caption" tone="muted">Saved. Verifying opens soon; until then, use an invitation code.</Text>
      ) : null}
      {problemLine ? <Text role="small" tone="danger">{problemLine}</Text> : null}
      {said ? <Text role="small">{said}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  content: { padding: space.lg, gap: space.md },
  handleRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  handle: { flex: 1 },
  code: { minHeight: 48, borderRadius: radius.xl, backgroundColor: colors.fill, alignItems: "center", justifyContent: "center" },
  ask: { gap: space.sm },
  pair: { flexDirection: "row", gap: space.sm },
});
