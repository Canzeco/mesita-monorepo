"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, MessageSquare, X } from "lucide-react";
import { type AdminVerification, decideVerification } from "./actions";
import { METHOD_ICON, METHOD_LABEL } from "./verification-config";
import { KV, StatusBadge, formatDate } from "./verification-ui";

export function VerificationRow({
  verification,
  onDecided,
}: {
  verification: AdminVerification;
  onDecided: (
    id: string,
    decision: "approved" | "rejected",
    rejectReason: string,
  ) => void;
}) {
  const Icon = METHOD_ICON[verification.method] ?? MessageSquare;
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [pending, startDecide] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected") => {
    if (pending) return;
    if (decision === "rejected" && !rejectReason.trim()) {
      setError("Reject reason is required.");
      return;
    }
    setError(null);
    startDecide(async () => {
      const r = await decideVerification(
        verification.id,
        decision,
        rejectReason.trim(),
      );
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onDecided(verification.id, decision, rejectReason.trim());
    });
  };

  return (
    <li
      className={
        "border-border bg-card flex flex-col gap-4 rounded-2xl border p-5 " +
        (verification.status === "pending" ? "" : "opacity-80")
      }
    >
      <div className="flex items-start gap-3">
        <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold tracking-tight">
            {verification.place?.name ?? "(deleted place)"}
          </p>
          <p className="text-muted-foreground text-xs">
            {METHOD_LABEL[verification.method]} · requested{" "}
            {formatDate(verification.created_at)} ·{" "}
            <span className="font-mono">{verification.requester_email}</span>
          </p>
        </div>
        <StatusBadge
          status={verification.status}
          decidedVia={verification.decided_via}
        />
      </div>

      <div className="border-border bg-background grid grid-cols-1 gap-3 rounded-xl border p-3 text-xs sm:grid-cols-2">
        <KV label="Place address">
          {verification.place?.address ?? "—"}
        </KV>
        <KV label="Google-listed phone">
          {verification.place?.phone ?? "—"}
        </KV>
        {verification.method === "video" && (
          <KV label="Video URL" wide>
            {typeof verification.payload.videoUrl === "string" ? (
              <a
                href={verification.payload.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-secondary break-all underline"
              >
                {verification.payload.videoUrl}
              </a>
            ) : (
              "—"
            )}
          </KV>
        )}
        {verification.method === "ai_call" && (
          <>
            <KV label="Phone called">
              <span className="font-mono">
                {typeof verification.payload.phoneCalled === "string"
                  ? verification.payload.phoneCalled
                  : "(no phone on place)"}
              </span>
            </KV>
            <KV label="OTP verified">
              {typeof verification.payload.codeVerifiedAt === "string"
                ? formatDate(verification.payload.codeVerifiedAt)
                : "—"}
            </KV>
          </>
        )}
        {verification.status === "rejected" && verification.reject_reason && (
          <KV label="Rejection reason" wide>
            {verification.reject_reason}
          </KV>
        )}
      </div>

      {error && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
          {error}
        </p>
      )}

      {verification.status === "pending" && (
        <div className="flex flex-col gap-3">
          {showRejectForm ? (
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
                  className="bg-destructive inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason("");
                    setError(null);
                  }}
                  disabled={pending}
                  className="border-border text-muted-foreground inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => decide("approved")}
                disabled={pending}
                className="bg-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Approve
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(true)}
                disabled={pending}
                className="border-border text-foreground hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
