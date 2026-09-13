"use client";

// Outcome cards for the Add place ceremony. Create vs Add vs Open vs
// held-by-another. No OTP, no MethodsPicker, no marketing radius.
import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import type { LookupPlace } from "@/lib/api/verifications";
import type { PlacePrediction } from "@/lib/api/place-search";
import { placeHref } from "@/lib/console-routes";
import {
  CTA_BUTTON_CLASS,
  ERROR_BOX_CLASS,
  TINY_LABEL_CLASS,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

function OwnerOnly() {
  return (
    <p className="text-muted-foreground text-sm">
      Only the owner can add a place to this organization.
    </p>
  );
}

function PlaceLines({
  name,
  detail,
}: {
  name: string;
  detail?: string | null;
}) {
  return (
    <div>
      <p className="font-display text-lg font-semibold tracking-tight">{name}</p>
      {detail ? (
        <p className="text-muted-foreground mt-0.5 text-sm">{detail}</p>
      ) : null}
    </div>
  );
}

export function CreatePlaceCard({
  prediction,
  canAdd,
  pending,
  error,
  onCreate,
}: {
  prediction: PlacePrediction;
  canAdd: boolean;
  pending: boolean;
  error: string | null;
  onCreate: () => void;
}) {
  return (
    <section
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      aria-label="Not on Mesita"
    >
      <span className={TINY_LABEL_CLASS}>Not on Mesita</span>
      <PlaceLines
        name={prediction.mainText}
        detail={prediction.secondaryText}
      />
      <p className="text-muted-foreground text-sm">
        Create this place, then add it to this organization.
      </p>
      {canAdd ? (
        <button
          type="button"
          disabled={pending}
          onClick={onCreate}
          className={cn(CTA_BUTTON_CLASS, "self-start")}
        >
          {pending ? "Creating..." : "Create"}
        </button>
      ) : (
        <OwnerOnly />
      )}
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </section>
  );
}

export function AddListedPlaceCard({
  place,
  canAdd,
  pending,
  error,
  onAdd,
}: {
  place: LookupPlace;
  canAdd: boolean;
  pending: boolean;
  error: string | null;
  onAdd: () => void;
}) {
  return (
    <section
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      aria-label="On Mesita"
    >
      <span className={TINY_LABEL_CLASS}>On Mesita</span>
      <PlaceLines name={place.name} detail={place.address} />
      <p className="text-muted-foreground text-sm">
        Add this place to this organization.
      </p>
      {canAdd ? (
        <button
          type="button"
          disabled={pending}
          onClick={onAdd}
          className={cn(CTA_BUTTON_CLASS, "self-start")}
        >
          {pending ? "Adding..." : "Add"}
        </button>
      ) : (
        <OwnerOnly />
      )}
      {error ? <p className={ERROR_BOX_CLASS}>{error}</p> : null}
    </section>
  );
}

export function OpenHeldPlaceCard({
  placeId,
  name,
}: {
  placeId: string;
  name: string;
}) {
  return (
    <section
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      aria-label="Already held"
    >
      <PlaceLines name={name} />
      <p className="text-muted-foreground text-sm">
        This organization already holds this place.
      </p>
      <Link href={placeHref(placeId)} className={cn(CTA_BUTTON_CLASS, "self-start")}>
        Open
      </Link>
    </section>
  );
}

export function PartnerOtherCard({
  place,
  ownerEmail,
}: {
  place: LookupPlace;
  ownerEmail: string | null;
}) {
  return (
    <section
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4"
      aria-label="Held by another organization"
    >
      <span className={TINY_LABEL_CLASS}>Held by another organization</span>
      <PlaceLines name={place.name} detail={place.address} />
      <p className="text-muted-foreground text-sm">
        {ownerEmail
          ? `${ownerEmail} holds this place.`
          : "Another organization holds this place."}
      </p>
      <div className="flex flex-wrap gap-2">
        {ownerEmail ? (
          <a
            href={`mailto:${ownerEmail}?subject=${encodeURIComponent(
              `About ${place.name} on Mesita`,
            )}`}
            className={cn(CTA_BUTTON_CLASS, "self-start")}
          >
            <Mail className="h-4 w-4" />
            Contact owner
          </a>
        ) : null}
        <a
          href={`mailto:fraud@canzeco.com?subject=${encodeURIComponent(
            `Fraud report — ${place.name} (${place.id})`,
          )}`}
          className={cn(
            "border-destructive/40 text-destructive hover:bg-destructive/5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          Report fraud
        </a>
      </div>
    </section>
  );
}
