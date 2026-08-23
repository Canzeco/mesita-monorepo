"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { type AdminPlace } from "../actions";
import { useSectionSaver } from "../useSectionDirty";
import { usePlaceContext } from "../PlaceContext";
import { SectionCard } from "../ui";
import {
  ChannelPicker,
  channelOptions,
  readChannel,
  type ChannelKey,
} from "./ChannelPicker";

// Reservations — which Place → Channels contact the Reservationist uses.
// Moved onto Settings (MESITA-837). Voice-only today (MESITA-842): phone is
// the only selectable serving channel; WhatsApp + Instagram are parked with
// Soon until a Messages path ships (MESITA-839). The picker itself is shared
// with Orders (MESITA-1155) — both rails ask the same question.
//
// The rail this feeds: a guest books, a reservation_ticket opens at `pending`,
// and the a1–a4 agent graphs call THIS number until the ticket lands —
// confirmed · declined · unreachable · no_show · cancelled · unresolved.
// Retries, callbacks and negotiation rounds are Mesita-wide (Configurations →
// Reservations); the number is the only per-place decision, which is why it is
// the only control in this box. The place answers a phone and nothing else:
// no login, no dashboard, no app.
export function ReservationsCard({
  place,
}: {
  place: AdminPlace;
}) {
  const options = useMemo(() => channelOptions(place), [place]);
  const hasPhone = options[0].contact !== "";
  const saved = useMemo(
    () => readChannel(place.reservation_channel),
    [place.reservation_channel],
  );

  const [channel, setChannel] = useState<ChannelKey | "">(
    saved || (hasPhone ? "phone" : ""),
  );
  const { savePending } = usePlaceContext();

  const dirty = channel !== saved;

  const resetDraft = useCallback(() => {
    setChannel(saved || (hasPhone ? "phone" : ""));
  }, [saved, hasPhone]);

  useSectionSaver(
    "reservations",
    dirty,
    () => {
      if (!dirty) return { kind: "clean" };
      if (!channel || !hasPhone) {
        return {
          kind: "invalid",
          error:
            "Set a phone under Place → Channels — the agent books by voice only.",
        };
      }
      return {
        kind: "patch",
        patch: {
          reservation_channel: "phone",
          reservation_target: options[0].contact || null,
        },
      };
    },
    () => {
      // `saved` re-derives from the refreshed place row; nothing local to seed.
    },
    resetDraft,
  );

  return (
    <SectionCard
      icon={<CalendarCheck className="h-4 w-4" />}
      tint="teal"
      title="Reservations"
    >
      <div className="mt-3.5">
        <ChannelPicker
          options={options}
          selected={channel}
          onSelect={setChannel}
          disabled={savePending}
          ariaLabel="Reservation channel"
          soonVerb="booking"
        />
      </div>
    </SectionCard>
  );
}
