"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import {
  type AdminVerification,
  type AutoVerifyMethod,
  setAutoVerify,
} from "./actions";
import { AutoModeToggle } from "./AutoModeToggle";
import { VerificationRow } from "./VerificationRow";
import { formatDate } from "./verification-ui";

export function VerificationsClient({
  initialVerifications,
  initialAutoVerifyAiCall,
  initialAutoVerifyVideo,
  initialAutoVerifyUpdatedAt,
}: {
  initialVerifications: AdminVerification[];
  initialAutoVerifyAiCall: boolean;
  initialAutoVerifyVideo: boolean;
  initialAutoVerifyUpdatedAt: string | null;
}) {
  const [verifications, setVerifications] = useState(initialVerifications);
  const [autoAiCall, setAutoAiCall] = useState(initialAutoVerifyAiCall);
  const [autoVideo, setAutoVideo] = useState(initialAutoVerifyVideo);
  const [autoVerifyUpdatedAt, setAutoVerifyUpdatedAt] = useState(
    initialAutoVerifyUpdatedAt,
  );
  const [topError, setTopError] = useState<string | null>(null);
  const [pendingMethod, setPendingMethod] = useState<AutoVerifyMethod | null>(
    null,
  );
  const [, startAutoToggle] = useTransition();

  const toggleMethod = (method: AutoVerifyMethod) => {
    if (pendingMethod) return;
    setTopError(null);
    const next = method === "ai_call" ? !autoAiCall : !autoVideo;
    setPendingMethod(method);
    startAutoToggle(async () => {
      const r = await setAutoVerify(method, next);
      setPendingMethod(null);
      if (!r.ok) {
        setTopError(r.error);
        return;
      }
      setAutoAiCall(r.autoVerifyAiCall);
      setAutoVideo(r.autoVerifyVideo);
      setAutoVerifyUpdatedAt(r.autoVerifyUpdatedAt);
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
    <div className="mt-6 flex flex-col gap-6 sm:mt-8 sm:gap-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AutoModeToggle
          method="ai_call"
          label="Auto-confirm phone OTP"
          blurb="When ON, picking up the call and reading the 6-digit code grants ownership instantly. When OFF, the code is still validated but the request lands here for manual approval."
          enabled={autoAiCall}
          pending={pendingMethod === "ai_call"}
          onToggle={() => toggleMethod("ai_call")}
        />
        <AutoModeToggle
          method="video"
          label="Auto-confirm video walkthrough"
          blurb="When ON, any submitted video URL grants ownership without review — for trusted operators only. When OFF, every video lands here for a human to watch."
          enabled={autoVideo}
          pending={pendingMethod === "video"}
          onToggle={() => toggleMethod("video")}
        />
      </div>
      <p className="text-muted-foreground -mt-4 text-[11px]">
        {autoVerifyUpdatedAt
          ? `Policy last changed ${formatDate(autoVerifyUpdatedAt)}`
          : "Policy never changed"}
      </p>

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
