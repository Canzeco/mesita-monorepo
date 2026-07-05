import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Database } from "@/lib/supabase/database.types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketKind = Database["public"]["Enums"]["ticket_kind"];
type StoryStatus = Database["public"]["Enums"]["story_status"];

export type TicketConsumer = {
  id: string;
  code: string | null;
  full_name: string | null;
  birthday: string | null;
  sex: string | null;
  country: string | null;
  tier_key: string | null;
  tier_origin: string | null;
};

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
  // The EF's join arrives as an object or a one-element array depending on
  // the relationship cardinality PostgREST infers; normalize before use.
  consumer: TicketConsumer | TicketConsumer[] | null;
};

export type BusinessTicket = Omit<RawTicket, "consumer"> & {
  consumer: TicketConsumer | null;
};

function normalizeTicketConsumer(row: RawTicket): BusinessTicket {
  const consumer = Array.isArray(row.consumer)
    ? (row.consumer[0] ?? null)
    : row.consumer;
  return { ...row, consumer };
}

export async function apiListTickets(
  client: SupabaseClient,
  input: { projectId: string; limit?: number },
): Promise<BusinessTicket[]> {
  const { tickets } = await invokeEF<{ tickets: RawTicket[] }>(
    client,
    "business-web-list-tickets",
    // Canonical payload key is `placeId` (MESITA-26); local naming unchanged.
    { placeId: input.projectId, limit: input.limit },
    "Couldn't load tickets.",
  );
  return (tickets ?? []).map(normalizeTicketConsumer);
}

export async function apiMarkTicketPaid(
  client: SupabaseClient,
  ticketId: string,
): Promise<{ status?: string; alreadyPaid?: boolean }> {
  return invokeEF<{ status?: string; alreadyPaid?: boolean }>(
    client,
    "business-web-mark-ticket-paid",
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
    "business-web-cancel-ticket",
    input,
    "Couldn't cancel ticket.",
  );
}

/** Scan step — link guest code without billing. */
export async function apiOpenTicket(
  client: SupabaseClient,
  input: {
    projectId: string;
    consumerCode: string;
    /** Legacy EF wire kind (e.g. "dp", "s_dp_sf") — see ticket-staff-lifecycle. */
    kind?: string;
  },
): Promise<{ ticket: BusinessTicket }> {
  return invokeEF<{ ticket: BusinessTicket }>(
    client,
    "business-web-create-ticket",
    {
      // Canonical payload key is `placeId` (MESITA-26); local naming unchanged.
      placeId: input.projectId,
      consumerCode: input.consumerCode,
      kind: input.kind ?? "dp",
      scanOnly: true,
    },
    "Couldn't scan guest.",
  );
}

/** Billing step — attach check totals to an open ticket. */
export async function apiSubmitTicketBill(
  client: SupabaseClient,
  input: {
    ticketId: string;
    checkSubtotalCents: number;
    tipCents?: number;
    redeemCents?: number;
  },
): Promise<{ ticket: BusinessTicket }> {
  return invokeEF<{ ticket: BusinessTicket }>(
    client,
    "business-web-submit-ticket-bill",
    {
      ticketId: input.ticketId,
      checkSubtotalCents: input.checkSubtotalCents,
      tipCents: input.tipCents ?? 0,
      redeemCents: input.redeemCents ?? 0,
    },
    "Couldn't submit bill.",
  );
}
