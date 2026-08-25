"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Loader2, X } from "lucide-react";
import {
  decidePlaceVerification,
  listPlaceVerifications,
  type AdminPlace,
  type PlaceVerificationGlance,
  type PlaceVerificationRequest,
} from "../actions";
import { notifyPlaceVerificationChanged } from "../verification-events";
import { methodLabel } from "../../verifications/verification-config";
import {
  ConfirmDialog,
  ReadField,
  SectionCard,
} from "@/components/admin-ui/manage";
import { ErrorNote } from "@/components/ErrorNote";
import { formatAbsoluteUtc } from "@/lib/format";
import { statusBoolChip } from "@/lib/status-vocabulary";

// Verification — the ownership-proof box on Admin (MESITA-1320).
//
// Verified = somebody proved they own the place. One-time, never lapses,
// grants nothing on its own. Independent of Partner / plan. Status still
// prints the bool; this box is who / when / method and the operator door
// onto the existing queue (admin-web-list-verifications +
// admin-web-decide-verification). No second ownership model.

export function VerificationCard({
  place,
  verification,
  verificationError,
  onChanged,
}: {
  place: AdminPlace;
  verification: PlaceVerificationGlance | null | undefined;
  verificationError: string | null;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<PlaceVerificationRequest[] | undefined>(
    undefined,
  );
  const [listError, setListError] = useState<string | null>(null);

  const loadList = (placeId: string) => {
    listPlaceVerifications(placeId).then((r) => {
      if (!r.ok) {
        setListError(r.error);
        setRows([]);
        return;
      }
      setListError(null);
      setRows(r.data);
    });
  };

  useEffect(() => {
    let alive = true;
    listPlaceVerifications(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setListError(r.error);
        setRows([]);
        return;
      }
      setListError(null);
      setRows(r.data);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const verified = Boolean(verification?.verifiedByEmail);
  const pending = rows?.find((row) => row.status === "pending") ?? null;
  const latestRejected =
    rows?.find((row) => row.status === "rejected") ?? null;

  const chip = verificationError
    ? "?"
    : verification === undefined
      ? "…"
      : statusBoolChip(verified);

  return (
    <SectionCard
      icon={<BadgeCheck className="h-4 w-4" />}
      tint="emerald"
      title="Verification"
      subtitle="Ownership proof — one-time, never lapses, grants nothing."
    >
      <div className="mt-5 flex flex-col gap-4">
        <ReadField label="Status" boxed>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold tabular-nums " +
                (verified
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-muted text-muted-foreground")
              }
              aria-label={`Verified: ${chip}`}
            >
              {chip}
            </span>
            <span className="text-muted-foreground type-label">
              {verificationError
                ? "Couldn't read the verification record."
                : verification === undefined
                  ? "Checking…"
                  : verified
                    ? "Somebody proved they own this place."
                    : "Nobody has completed ownership verification yet."}
            </span>
          </span>
        </ReadField>

        {verified ? (
          <>
            <ReadField label="Verified by" boxed>
              <span className="truncate font-mono type-body">
                {verification?.verifiedByEmail}
              </span>
            </ReadField>
            <ReadField label="When" boxed>
              {verification?.decidedAt
                ? formatAbsoluteUtc(verification.decidedAt)
                : "—"}
            </ReadField>
            <ReadField label="Method" boxed>
              {[
                methodLabel(verification?.method),
                verification?.decidedVia
                  ? verification.decidedVia.replace(/_/g, " ")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </ReadField>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Ownership proof does not lapse. There is no undo on this box.
            </p>
          </>
        ) : null}

        {listError ? <ErrorNote message={listError} /> : null}

        {!verified && pending ? (
          <PendingProof
            placeName={place.name}
            row={pending}
            onDecided={() => {
              loadList(place.id);
              onChanged();
              notifyPlaceVerificationChanged(place.id);
            }}
          />
        ) : null}

        {!verified && !pending && latestRejected ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Last request from{" "}
            <span className="font-mono">{latestRejected.requester_email}</span>
            {" · "}
            {methodLabel(latestRejected.method)}
            {" · rejected"}
            {latestRejected.reject_reason
              ? ` — ${latestRejected.reject_reason}`
              : ""}
            .
          </p>
        ) : null}

        {!verified && !pending ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Proofs arrive through the Verification Queue — phone OTP, email
              OTP, or a manual contact request. Approving a row there is what
              stamps Verified.
            </p>
            <Link
              href="/verifications"
              className="border-border/70 text-foreground/80 hover:bg-muted hover:text-foreground inline-flex h-9 w-fit items-center rounded-full border px-4 text-xs font-semibold transition"
            >
              Open Verification Queue
            </Link>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function PendingProof({
  placeName,
  row,
  onDecided,
}: {
  placeName: string;
  row: PlaceVerificationRequest;
  onDecided: () => void;
}) {
  const [pending, startDecide] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const decide = (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !rejectReason.trim()) {
      setError("Reject reason is required.");
      return;
    }
    setError(null);
    startDecide(async () => {
      const r = await decidePlaceVerification(
        row.id,
        decision,
        rejectReason.trim(),
      );
      setConfirming(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRejecting(false);
      setRejectReason("");
      onDecided();
    });
  };

  return (
    <div className="border-border/70 flex flex-col gap-3 rounded-xl border p-3">
      <p className="text-foreground/90 type-body font-medium">Pending proof</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        <span className="font-mono">{row.requester_email}</span>
        {" · "}
        {methodLabel(row.method)}
        {" · requested "}
        {formatAbsoluteUtc(row.created_at)}
        . Approve grants this requester ownership of the place.
      </p>

      {error ? <ErrorNote message={error} /> : null}

      {rejecting ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why are you rejecting? (shown to the business)"
            rows={2}
            className="border-border bg-background rounded-xl border px-3 py-2 text-sm outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decide("rejected")}
              disabled={pending}
              className="bg-destructive inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setRejectReason("");
                setError(null);
              }}
              disabled={pending}
              className="border-border text-muted-foreground inline-flex h-9 items-center rounded-full border px-4 text-xs font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            className="bg-foreground text-background inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Approve
          </button>
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Approve this proof?"
        busy={pending}
        confirmLabel="Approve"
        body={
          <p>
            {row.requester_email} becomes the owner of {placeName}. Verified
            is one-time and never lapses. It does not grant a paid plan.
          </p>
        }
        onConfirm={() => decide("approved")}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
