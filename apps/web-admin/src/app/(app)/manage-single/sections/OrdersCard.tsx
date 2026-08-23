"use client";

import { useCallback, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { type AdminPlace } from "../actions";
import { useSectionSaver } from "../useSectionDirty";
import { usePlaceContext } from "../PlaceContext";
import { CrossTabLink, SectionCard } from "../ui";
import {
  ChannelPicker,
  channelOptions,
  readChannel,
  type ChannelKey,
} from "./ChannelPicker";

// Orders — the REMOTE context (MESITA-1148 · MESITA-1155).
//
// Mesita prices exactly two contexts: a VISIT (the guest is at the place) and
// an ORDER (the guest is not). Visits shipped; orders have no table, no EF and
// no consumer type, so the box wears Soon.
//
// It still carries ONE real decision, and Pato asked for it explicitly: which
// contact an order reaches the place on. Same picker as Reservations, same
// storage shape (the typed `order_channel` / `order_target` columns), phone the only live
// channel. It is a STAGED knob — stored now, read when the rail ships — and
// the box says so rather than pretending the switch does something today.
export function OrdersCard({
  place,
}: {
  place: AdminPlace;
}) {
  const options = useMemo(() => channelOptions(place), [place]);
  const hasPhone = options[0].contact !== "";
  const saved = useMemo(
    () => readChannel(place.order_channel),
    [place.order_channel],
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
    "orders",
    dirty,
    () => {
      if (!dirty) return { kind: "clean" };
      if (!channel || !hasPhone) {
        return {
          kind: "invalid",
          error:
            "Set a phone under Place → Channels — ordering is voice-only for now.",
        };
      }
      return {
        kind: "patch",
        patch: {
          order_channel: "phone",
          order_target: options[0].contact || null,
        },
      };
    },
    () => {
      // `saved` is derived from the place row the page just refreshed, so the
      // draft re-derives itself; nothing local to re-seed.
    },
    resetDraft,
  );

  const links = [
    { label: "Uber Eats", value: place.uber_eats_url },
    { label: "Website", value: place.website_url },
  ].filter((l) => typeof l.value === "string" && l.value.trim() !== "");

  return (
    <SectionCard
      icon={<ShoppingBag className="h-4 w-4" />}
      tint="violet"
      title="Orders"
      action={
        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-1 type-meta font-bold tracking-wider uppercase">
          Soon
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Order tickets don&apos;t exist yet — no rail, no ticket, no receipt to
        read. The channel below is the one thing worth deciding in advance:
        it saves now and the rail reads it the day it ships. Quotas, minimums
        and fulfilment are Mesita-wide, under Configurations → Orders.
      </p>
      <div className="mt-3.5">
        <ChannelPicker
          options={options}
          selected={channel}
          onSelect={setChannel}
          disabled={savePending}
          ariaLabel="Order channel"
          soonVerb="ordering"
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
    </SectionCard>
  );
}
