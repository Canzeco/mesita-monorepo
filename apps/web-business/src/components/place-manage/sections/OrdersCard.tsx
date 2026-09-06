"use client";

import { useCallback, useMemo, useState } from "react";
import { type AdminPlace } from "../actions";
import { useSectionSaver } from "../useSectionDirty";
import { usePlaceContext } from "../PlaceContext";
import { CrossTabLink } from "../ui";
import {
  ChannelPicker,
  readChannel,
  targetForChannel,
  type ChannelKey,
} from "./ChannelPicker";

// Orders — the REMOTE context. Same five picks as Reservations. The rail
// is still Soon; the channel saves now so the day it ships there is a door.

export function OrdersCard({
  place,
}: {
  place: AdminPlace;
}) {
  const saved = useMemo(
    () => readChannel(place.order_channel),
    [place.order_channel],
  );

  const [channel, setChannel] = useState<ChannelKey | "">(saved);
  const { savePending } = usePlaceContext();

  const dirty = channel !== saved;

  const resetDraft = useCallback(() => {
    setChannel(saved);
  }, [saved]);

  useSectionSaver(
    "orders",
    dirty,
    () => {
      if (!dirty) return { kind: "clean" };
      if (!channel) {
        return { kind: "invalid", error: "Pick an order channel, or Not." };
      }
      if (channel !== "none" && !targetForChannel(place, channel)) {
        return {
          kind: "invalid",
          error: `Add a ${channel} contact under Place → Channels first.`,
        };
      }
      return {
        kind: "patch",
        patch: {
          order_channel: channel,
          order_target: targetForChannel(place, channel),
        },
      };
    },
    () => {},
    resetDraft,
  );

  const links = [
    { label: "Uber Eats", value: place.uber_eats_url },
    { label: "Website", value: place.website_url },
  ].filter((l) => typeof l.value === "string" && l.value.trim() !== "");

  return (
    <div className="flex flex-col">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Order tickets don&apos;t exist yet — no rail, no ticket, no receipt to
        read. The channel below saves now; the rail reads it the day it ships.
        Quotas, minimums and fulfilment are Mesita-wide, under Configurations
        → Orders.
      </p>
      <div className="mt-3">
        <ChannelPicker
          place={place}
          selected={channel}
          onSelect={setChannel}
          disabled={savePending}
          ariaLabel="Order channel"
          noneHint="This place does not take orders."
        />
      </div>

      <div className="border-border/60 mt-4 border-t pt-4">
        <span className="text-foreground/90 type-body font-medium">
          Ordering links on file
        </span>
        {links.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.label} className="text-muted-foreground truncate text-xs">
                <span className="text-foreground/80 font-medium">{l.label}:</span>{" "}
                {l.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-2 text-xs">
            None yet — a place with no ordering link can&apos;t be in the first
            wave.
          </p>
        )}
        <div className="mt-3">
          <CrossTabLink href={`/manage-single/${place.id}/place`}>
            Edit contacts under Place → Channels
          </CrossTabLink>
        </div>
      </div>
    </div>
  );
}
