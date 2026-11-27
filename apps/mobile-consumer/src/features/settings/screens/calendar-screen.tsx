import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { z } from "zod";

import { ErrorState } from "@/components/error-state";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { callEdge } from "@/lib/edge";
import { useErrorCopy } from "@/lib/error-copy";
import { queryClient } from "@/lib/query";
import { colors, space } from "@/theme";

const feed = z.object({
  url: z.string().catch(""),
  on: z.boolean().catch(false),
  last_read_at: z.string().nullish().catch(null),
});

const answer = z.object({
  calendars: z.object({ google: feed, apple: feed, outlook: feed }),
});

type Kind = "google" | "apple" | "outlook";
type Feed = z.infer<typeof feed>;

const ROWS: { kind: Kind; label: string; app: string }[] = [
  { kind: "google", label: "Google Calendar", app: "Google Calendar" },
  { kind: "apple", label: "Apple Calendar", app: "Apple Calendar" },
  { kind: "outlook", label: "Outlook", app: "Outlook" },
];

function loadCalendars(body: Record<string, unknown>, signal?: AbortSignal) {
  return callEdge("consumer-web-get-calendar-link", body, answer, { signal, mutation: Object.keys(body).length > 0 });
}

function webcal(https: string): string {
  return https.replace(/^https?:\/\//, "webcal://");
}

function subscribeUrl(kind: Kind, https: string): string {
  if (kind === "google") return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal(https))}`;
  if (kind === "apple") return webcal(https);
  return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent("Mesita reservations")}`;
}

function synced(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "Synced";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

/** Google, Apple, and Outlook. A calendar that has read its link switches on and off. */
export function CalendarScreen() {
  const query = useQuery({ queryKey: ["calendars"], queryFn: ({ signal }) => loadCalendars({}, signal) });
  const copy = useErrorCopy(query.error);
  const [added, setAdded] = useState<Partial<Record<Kind, boolean>>>({});
  const [pending, setPending] = useState<Kind | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState title="Couldn't load your calendars." message="Try again." offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const rows = query.data.calendars;

  const refresh = async (body: Record<string, unknown>) => {
    const next = await loadCalendars(body);
    queryClient.setQueryData(["calendars"], next);
    return next;
  };

  const flip = (kind: Kind, app: string, on: boolean) => {
    setPending(kind);
    setSaid(null);
    void refresh({ calendar: kind, on })
      .then(() => setSaid(on ? `${app} is on.` : `${app} is off. Your tables are removed on its next sync.`))
      .catch(() => setSaid("Couldn't change it."))
      .finally(() => setPending(null));
  };

  const askOff = (kind: Kind, app: string) => {
    Alert.alert(`Turn off ${app}?`, `Your Mesita tables are removed from ${app} on its next sync.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Turn off", onPress: () => flip(kind, app, false) },
    ]);
  };

  const reset = () => {
    Alert.alert("Make new links?", "Every calendar using the old links stops updating. Add your calendars again after.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Make new links",
        onPress: () => {
          setSaid(null);
          void refresh({ reset: true })
            .then(() => {
              setAdded({});
              setSaid("New links made. Add your calendars again.");
            })
            .catch(() => setSaid("Couldn't make new links."));
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <SettingsGroup title="Your calendars">
        {ROWS.map((row) => (
          <CalendarRow
            key={row.kind}
            row={row}
            feed={rows[row.kind]}
            pending={pending === row.kind}
            added={added[row.kind] === true}
            onAdd={() => {
              setAdded((current) => ({ ...current, [row.kind]: true }));
              const url = rows[row.kind].url;
              if (url) void Linking.openURL(subscribeUrl(row.kind, url));
            }}
            onSwitch={(on) => (on ? flip(row.kind, row.app, true) : askOff(row.kind, row.app))}
          />
        ))}
      </SettingsGroup>
      <Pressable accessibilityRole="button" onPress={reset} style={styles.reset}>
        <Text role="caption" tone="muted">Make new links</Text>
      </Pressable>
      {said ? <Text role="small">{said}</Text> : null}
    </ScrollView>
  );
}

function CalendarRow({
  row,
  feed,
  pending,
  added,
  onAdd,
  onSwitch,
}: {
  row: (typeof ROWS)[number];
  feed: Feed;
  pending: boolean;
  added: boolean;
  onAdd: () => void;
  onSwitch: (on: boolean) => void;
}) {
  if (feed.last_read_at) {
    const sub = feed.on ? synced(feed.last_read_at) : `Off · your tables leave ${row.app} on its next sync`;
    return (
      <View style={styles.row}>
        <View style={styles.words}>
          <Text role="label">{row.label}</Text>
          <Text role="caption" tone="muted">{sub}</Text>
        </View>
        <Switch
          accessibilityLabel={row.label}
          value={feed.on}
          disabled={pending}
          onValueChange={onSwitch}
          trackColor={{ true: colors.ink, false: colors.fill }}
        />
      </View>
    );
  }
  return (
    <SettingsRow
      icon="calendar"
      label={row.label}
      sub={added ? `Finish in ${row.app}; it shows here once connected` : "Not connected"}
      onPress={onAdd}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  words: { flex: 1, gap: 2 },
  reset: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
});
