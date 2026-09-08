"use server";

// Server actions for the Credits Liability screen (MESITA-1679). Thin
// wrappers over the admin-web-* Edge Functions via the Result-style
// efInvoke (never throws). No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import type { CreditLiability } from "./types";

type GetResult =
  | { ok: true; liability: CreditLiability }
  | { ok: false; error: string };

export async function getCreditLiability(): Promise<GetResult> {
  const r = await efInvoke<{ liability: CreditLiability }>(
    "admin-web-list-credit-liability",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, liability: r.data.liability };
}

export type ReverseCreditLotInput = {
  kind: "refund" | "adjust";
  reason: string;
  lotId?: string;
  organizationId?: string;
  consumerId?: string;
  amountCents?: number;
};

type ReverseResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

export async function reverseCreditLot(
  input: ReverseCreditLotInput,
): Promise<ReverseResult> {
  const r = await efInvoke<Record<string, unknown>>(
    "admin-web-refund-credit-lot",
    input,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: r.data };
}
