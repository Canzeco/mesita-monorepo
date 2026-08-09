"use client";

import { useState } from "react";
import type { AdminVerification } from "./actions";
import { VerificationRow } from "./VerificationRow";

export function VerificationsClient({
  initialVerifications,
}: {
  initialVerifications: AdminVerification[];
}) {
  const [verifications, setVerifications] = useState(initialVerifications);

  const onDecided = (
    id: string,
    decision: "approved" | "rejected",
    rejectReason: string,
  ) => {
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
