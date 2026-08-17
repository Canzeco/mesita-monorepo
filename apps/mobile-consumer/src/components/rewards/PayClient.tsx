// The wallet (v4 · MESITA-1094) — mobile mirror of web's NewVisitClient:
// a SEARCHBAR over a bare place list, and nothing else. No tabs, no ticket
// lists, no steps rail — history lives in Inbox › Visits, and the pointer
// stays because a feature that MOVED needs a forwarding address.
//
// ONE TAP CREATES THE TICKET at "base" and opens THE TICKET, the seven-step
// journey (/rewards/ticket/[id]). The reward is picked INSIDE the journey and
// re-prices upward — there is no create-time choice any more (the old
// wantsStory interstitial died with v4). A place already holding a live
// ticket re-opens it instead of 409-ing.

import { useRouter } from "expo-router";
import { ChevronRight, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { PlacePickList } from "@/components/rewards/PlacePickList";
import { SavingsReveal } from "@/components/rewards/SavingsReveal";
import { COLORS } from "@/constants/brand";
import type { Place } from "@/lib/api/places";
import {
  ACTIVE_TICKET_STATUSES,
  apiCreateTicket,
  apiListConsumerTickets,
  type ConsumerTicketRow,
} from "@/lib/api/tickets";
import { EFError } from "@/lib/ef";
import { useConsumerTickets } from "@/lib/hooks/useConsumerTickets";
import { TAB_SCROLL_PADDING_BOTTOM } from "@/lib/tab-layout";

export function PayClient({ userId }: { userId: string }) {
  const router = useRouter();
  const tickets = useConsumerTickets(userId);
  const [query, setQuery] = useState("");

  const activePlaceIds = useMemo(
    () => new Set(tickets.active.map((t) => t.project_id)),
    [tickets.active],
  );

  const [startingId, setStartingId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const openTicket = useCallback(
    (id: string) => {
      router.push(`/rewards/ticket/${id}`);
    },
    [router],
  );

  const startTicket = useCallback(
    async (place: Place) => {
      // A place with a live ticket re-opens it — never a second QR (D5).
      const existing = tickets.active.find((t) => t.project_id === place.id);
      if (existing) {
        openTicket(existing.id);
        return;
      }
      setStartingId(place.id);
      setStartError(null);
      try {
        const res = await apiCreateTicket(place.id, "base");
        void tickets.refresh();
        openTicket(res.ticket.id);
      } catch (err) {
        if (err instanceof EFError && err.code === "already_open") {
          const fromBody = err.body?.ticketId;
          let id = typeof fromBody === "string" ? fromBody : null;
          if (!id) {
            const rows = await apiListConsumerTickets().catch(
              () => [] as ConsumerTicketRow[],
            );
            id =
              rows.find(
                (t) =>
                  t.project_id === place.id &&
                  ACTIVE_TICKET_STATUSES.has(t.status),
              )?.id ?? null;
          }
          if (id) {
            openTicket(id);
            return;
          }
        }
        setStartError(
          err instanceof Error ? err.message : "Couldn't start the visit.",
        );
      } finally {
        setStartingId(null);
      }
    },
    [tickets, openTicket],
  );

  // The paid beat: a watched ticket flipping to revealed holds a savings
  // reveal before settling into Inbox › Visits.
  const [justPaid, setJustPaid] = useState<ConsumerTicketRow | null>(null);
  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tickets.status !== "ready") return;
    const prev = prevActiveIdsRef.current;
    const revealed = tickets.history.find(
      (t) => t.status === "revealed" && prev.has(t.id),
    );
    prevActiveIdsRef.current = new Set(tickets.active.map((t) => t.id));
    if (revealed) setJustPaid(revealed);
  }, [tickets.status, tickets.active, tickets.history]);

  return (
    <View className="flex-1">
      {/* The search field IS the header — a filter that scrolls away has
          stopped filtering. Same pill shape as the Search tab. */}
      <View className="border-b border-border px-4 pb-2.5 pt-1">
        <View className="h-12 flex-row items-center gap-2 rounded-full border border-border bg-card pl-4 pr-3">
          <Search size={16} color={COLORS.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find the place you're at…"
            placeholderTextColor={COLORS.mutedForeground}
            accessibilityLabel="Find the place you're at"
            className="min-w-0 flex-1 text-foreground"
            style={{ fontSize: 14 }}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <X size={16} color={COLORS.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/inbox")}
          className="mt-2 flex-row items-center justify-center gap-1"
          accessibilityRole="link"
        >
          <Text
            className="font-semibold text-muted-foreground"
            style={{ fontSize: 11.5 }}
          >
            Your visits live in Inbox
          </Text>
          <ChevronRight size={14} color={COLORS.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3.5 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: TAB_SCROLL_PADDING_BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        {justPaid ? (
          <SavingsReveal
            placeName={justPaid.place?.name ?? "the place"}
            savedCents={justPaid.discount_cents ?? 0}
            onDone={() => setJustPaid(null)}
          />
        ) : null}

        {startError ? (
          <Text
            className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
            style={{ fontSize: 12.5 }}
          >
            {startError}
          </Text>
        ) : null}

        {/* Step 1, and only step 1: every place on Mesita, narrowed to what
            the header's query matches. */}
        <PlacePickList
          activePlaceIds={activePlaceIds}
          busyPlaceId={startingId}
          onPick={(place) => void startTicket(place)}
          query={query}
          onClearQuery={() => setQuery("")}
        />
      </ScrollView>
    </View>
  );
}
