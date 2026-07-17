"use client";

import Link from "next/link";
import { MapPin, CalendarPlus, Phone } from "lucide-react";
import { toast } from "@/lib/toast";
import { placeHref } from "@/lib/place-route";

// Action cluster for reservation detail — View place / calendar / call /
// cancel. Kept scoped to what a reservation can do; payment, reward
// redemption, and the full place page each have their own surfaces.

export function ReservationActions({
  projectId,
  cancelled,
}: {
  projectId: string;
  cancelled: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <Link
        href={placeHref(projectId, "saved")}
        className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition"
      >
        <span className="flex items-center gap-3">
          <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">View place</span>
        </span>
        <span className="text-muted-foreground text-[12px]">
          Details, map, menu
        </span>
      </Link>

      {!cancelled && (
        <>
          <button
            type="button"
            onClick={() =>
              toast.action(
                "Calendar export lands with the booking integration.",
                { label: "Notify me", onClick: () => {} },
              )
            }
            className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
          >
            <span className="flex items-center gap-3">
              <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
                <CalendarPlus className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">Add to calendar</span>
            </span>
            <span className="text-muted-foreground text-[12px]">
              Google, Apple, Outlook
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              toast.action(
                "Calling the place from inside the app lands soon.",
                { label: "Notify me", onClick: () => {} },
              )
            }
            className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition"
          >
            <span className="flex items-center gap-3">
              <span className="bg-muted text-foreground flex h-9 w-9 items-center justify-center rounded-full">
                <Phone className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">Call place</span>
            </span>
            <span className="text-muted-foreground text-[12px]">
              If plans change
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              toast.action(
                "Cancellation lands with the booking integration. Email support@mesita.ai meanwhile.",
                { label: "Copy email", onClick: () => {} },
              )
            }
            className="border-border bg-card hover:bg-muted text-foreground/80 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition"
          >
            Cancel reservation
          </button>
        </>
      )}
    </section>
  );
}
