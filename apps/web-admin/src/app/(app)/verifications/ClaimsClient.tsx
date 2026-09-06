"use client";

import { useState } from "react";
import type { AdminPlaceClaim } from "./claims-actions";
import { ClaimRow } from "./ClaimRow";

export function ClaimsClient({
  initialClaims,
}: {
  initialClaims: AdminPlaceClaim[];
}) {
  const [claims, setClaims] = useState(initialClaims);

  const onDecided = (id: string) => {
    setClaims((rows) => rows.filter((c) => c.id !== id));
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">
        Pool claims
      </h2>
      <p className="text-muted-foreground -mt-2 text-xs">
        A pool claim grants ownership instantly (MESITA-1537) — this is the
        after-the-fact check, not a gate. Clear it once it looks like a real
        operator, or reverse it to drop the place back into the public pool.
      </p>
      {claims.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
          No unreviewed claims.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {claims.map((c) => (
            <ClaimRow key={c.id} claim={c} onDecided={onDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}
