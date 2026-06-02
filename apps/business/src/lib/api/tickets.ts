import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Database } from "@/lib/supabase/database.types";
import type { FiscalType } from "./venues";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketKind = Database["public"]["Enums"]["ticket_kind"];
type StoryStatus = Database["public"]["Enums"]["story_status"];

type RawTicket = {
  id: string;
  kind: TicketKind;
  status: TicketStatus;
  story_status: StoryStatus;
  story_screenshot_url: string | null;
  story_submitted_at: string | null;
  story_verified_at: string | null;
  story_reject_reason: string | null;
  check_subtotal_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  cashback_percent: number;
  cashback_cents: number | null;
  redeem_cents: number | null;
  discount_percent: number | null;
  discount_cents: number | null;
  revealed_at: string | null;
  reservation_status: Database["public"]["Enums"]["reservation_status"] | null;
  reservation_at: string | null;
  reservation_party_size: number | null;
  currency: string;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  consumer:
    | { id: string; code: string | null; full_name: string | null }
    | Array<{ id: string; code: string | null; full_name: string | null }>
    | null;
};

export type BusinessTicket = Omit<RawTicket, "consumer"> & {
  consumer: { id: string; code: string | null; full_name: string | null } | null;
};

function normalizeTicketConsumer(row: RawTicket): BusinessTicket {
  const consumer = Array.isArray(row.consumer)
    ? (row.consumer[0] ?? null)
    : row.consumer;
  return { ...row, consumer };
}

export async function apiListTickets(
  client: SupabaseClient,
  input: { venueId: string; limit?: number },
): Promise<BusinessTicket[]> {
  const { tickets } = await invokeEF<{ tickets: RawTicket[] }>(
    client,
    "business-list-tickets",
    input,
    "Couldn't load tickets.",
  );
  return (tickets ?? []).map(normalizeTicketConsumer);
}

export async function apiMarkTicketPaid(
  client: SupabaseClient,
  ticketId: string,
): Promise<{ awaitingStory?: boolean }> {
  return invokeEF<{ awaitingStory?: boolean }>(
    client,
    "business-mark-paid",
    { ticketId },
    "Couldn't mark ticket as paid.",
  );
}

export async function apiCancelTicket(
  client: SupabaseClient,
  input: { ticketId: string; reason?: string },
): Promise<{ alreadyCancelled?: boolean }> {
  return invokeEF<{ alreadyCancelled?: boolean }>(
    client,
    "business-cancel-ticket",
    input,
    "Couldn't cancel ticket.",
  );
}

export async function apiCreateTicket(
  client: SupabaseClient,
  input: {
    venueId: string;
    consumerCode: string;
    checkSubtotalCents: number;
    tipCents?: number;
    redeemCents?: number;
    fiscalType: FiscalType;
  },
): Promise<{ ticket: BusinessTicket }> {
  const kind = input.fiscalType === "formal" ? "p_c" : "dp";
  return invokeEF<{ ticket: BusinessTicket }>(
    client,
    "business-create-ticket",
    {
      venueId: input.venueId,
      consumerCode: input.consumerCode,
      checkSubtotalCents: input.checkSubtotalCents,
      tipCents: input.tipCents ?? 0,
      redeemCents: input.redeemCents ?? 0,
      kind,
    },
    "Couldn't create ticket.",
  );
}
