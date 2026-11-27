import { useQuery } from "@tanstack/react-query";
import { Linking, ScrollView, StyleSheet } from "react-native";
import { z } from "zod";

import { ErrorState } from "@/components/error-state";
import { SettingsGroup, SettingsRow } from "@/components/settings-row";
import { Skeleton } from "@/components/skeleton";
import { Text } from "@/components/text";
import { callEdge } from "@/lib/edge";
import { useErrorCopy } from "@/lib/error-copy";
import { colors, space } from "@/theme";

const calendar = z.object({
  url: z.string().catch(""),
  on: z.boolean().catch(false),
});

function loadCalendars(signal?: AbortSignal) {
  return callEdge(
    "consumer-web-get-calendar-link",
    {},
    z.object({
      calendars: z.object({ google: calendar, apple: calendar, outlook: calendar }),
    }),
    { signal },
  );
}

/** Google, Apple, and Outlook. Each row opens that calendar's private link. */
export function CalendarScreen() {
  const query = useQuery({ queryKey: ["calendars"], queryFn: ({ signal }) => loadCalendars(signal) });
  const copy = useErrorCopy(query.error);
  if (query.isPending) return <Skeleton style={styles.fill} />;
  if (query.isError) return <ErrorState message={copy.message} offline={copy.offline} requestId={copy.requestId} onRetry={() => void query.refetch()} />;
  const rows = query.data.calendars;
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.page}>
      <Text role="small" tone="muted">Google, Apple or Outlook</Text>
      <SettingsGroup>
        <SettingsRow icon="calendar" label="Google" sub={rows.google.on ? "On" : "Off"} onPress={() => rows.google.url && void Linking.openURL(rows.google.url)} />
        <SettingsRow icon="calendar" label="Apple" sub={rows.apple.on ? "On" : "Off"} onPress={() => rows.apple.url && void Linking.openURL(rows.apple.url)} />
        <SettingsRow icon="calendar" label="Outlook" sub={rows.outlook.on ? "On" : "Off"} onPress={() => rows.outlook.url && void Linking.openURL(rows.outlook.url)} />
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.page },
  page: { padding: space.lg, gap: space.md },
});
