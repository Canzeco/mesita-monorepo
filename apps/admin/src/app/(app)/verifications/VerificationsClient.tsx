"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Phone,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  type AdminVerification,
  decideVerification,
  setAutoVerify,
} from "./actions";

const METHOD_ICON = {
  ai_call: Phone,
  video: Video,
  postcard: Mail,
} as const;

const METHOD_LABEL = {
  ai_call: "AI phone call",
  video: "Walkthrough video",
  postcard: "Postcard",
} as const;

export function VerificationsClient({
  initialVerifications,
  initialAutoVerify,
  initialAutoVerifyUpdatedAt,
}: {
  initialVerifications: AdminVerification[];
  initialAutoVerify: boolean;
  initialAutoVerifyUpdatedAt: string | null;
}) {
  const [verifications, setVerifications] = useState(initialVerifications);
  const [autoVerify, setAutoVerifyState] = useState(initialAutoVerify);
  const [autoVerifyUpdatedAt, setAutoVerifyUpdatedAt] = useState(
    initialAutoVerifyUpdatedAt,
  );
  const [topError, setTopError] = useState<string | null>(null);
  const [autoPending, startAutoToggle] = useTransition();

  const onToggleAuto = () => {
    if (autoPending) return;
    setTopError(null);
    const next = !autoVerify;
    startAutoToggle(async () => {
      const r = await setAutoVerify(next);
      if (!r.ok) {
        setTopError(r.error);
        return;
      }
      setAutoVerifyState(r.enabled);
      setAutoVerifyUpdatedAt(new Date().toISOString());
    });
  };

  const onDecided = (id: string, decision: "approved" | "rejected", rejectReason: string) => {
    setVerifications((rows) =>
      rows.map((v) =>
        v.id === id
          ? {
              ...v,
              status: decision,
              decided_at: new Date().toISOString(),
              decided_via: "admin" as const,
              reject_reason: decision === "rejected" ? rejectReason : null,
            }
          : v,
      ),
    );
  };

  return (
    <div className="mt-8 flex flex-col gap-8">
      <AutoModeToggle
        enabled={autoVerify}
        pending={autoPending}
        onToggle={onToggleAuto}
        updatedAt={autoVerifyUpdatedAt}
      />

      {topError && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="font-medium">{topError}</p>
        </div>
      )}

      {verifications.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
          No verification requests yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {verifications.map((v) => (
            <VerificationRow key={v.id} verification={v} onDecided={onDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AutoModeToggle({
  enabled,
  pending,
  onToggle,
  updatedAt,
}: {
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
  updatedAt: string | null;
}) {
  return (
    <div className="border-border bg-card flex items-start gap-4 rounded-2xl border p-5">
      <span
        className={
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full " +
          (enabled
            ? "bg-secondary/15 text-secondary"
            : "bg-muted text-muted-foreground")
        }
      >
        <Zap className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold tracking-tight">
          Auto-approve mode
        </p>
        <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
          When ON, submitted verification requests skip this queue and land
          as approved on insert. The venue flips to <code>active</code>{" "}
          immediately. Existing approved + rejected requests are kept in the
          history below either way.
        </p>
        <p className="text-muted-foreground mt-1 text-[11px]">
          {updatedAt ? `Last changed ${formatDate(updatedAt)}` : "Never changed"}
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-pressed={enabled}
        className={
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 " +
          (enabled ? "bg-secondary" : "bg-muted")
        }
      >
        <span
          className={
            "bg-card inline-block h-5 w-5 transform rounded-full shadow transition " +
            (enabled ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}

function VerificationRow({
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
  const Icon = METHOD_ICON[verification.method];
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
            {verification.venue?.name ?? "(deleted venue)"}
          </p>
          <p className="text-muted-foreground text-[12px]">
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

      <div className="border-border bg-background grid grid-cols-1 gap-3 rounded-xl border p-3 text-[12px] sm:grid-cols-2">
        <KV label="Venue address">
          {verification.venue?.address ?? "—"}
        </KV>
        <KV label="Google-listed phone">
          {verification.venue?.phone ?? "—"}
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
          <KV label="Phone we would call" wide>
            <span className="font-mono">
              {typeof verification.payload.phoneCalled === "string"
                ? verification.payload.phoneCalled
                : "(no phone on venue)"}
            </span>
          </KV>
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
                placeholder="Why are you rejecting? (shown to the manager)"
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

function StatusBadge({
  status,
  decidedVia,
}: {
  status: "pending" | "approved" | "rejected";
  decidedVia: "auto" | "admin" | null;
}) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 uppercase">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="bg-secondary/15 text-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
        <CheckCircle2 className="h-3 w-3" />
        Approved
        {decidedVia === "auto" && <span>· auto</span>}
      </span>
    );
  }
  return (
    <span className="bg-destructive/10 text-destructive inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
      <X className="h-3 w-3" />
      Rejected
    </span>
  );
}

function KV({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-muted-foreground text-[9px] font-medium tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
