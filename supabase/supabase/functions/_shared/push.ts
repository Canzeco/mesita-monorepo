// A reservation push. Only consumer_notify 'app' sends. The payload is the
// place name and the reservation state. It never includes an amount, a token,
// or a link. A failed send does not throw into the reservation that already
// committed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

import type { ReservationNotice } from "./reservation-notification.ts";
import { readConsumerNotify } from "./reservation-doc.ts";

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";
const TRIES = 3;

export type PushMessage = {
  title: string;
  body: string;
  data: { place_name?: string; state: string };
};

/** The locked-screen text. Place name and state only. */
export function reservationPushMessage(placeName: string | null, outcome: string): PushMessage {
  const name = (placeName ?? "").trim().slice(0, 80);
  const state = outcome.slice(0, 40);
  const data: PushMessage["data"] = { state };
  if (name && name !== "(unnamed)") data.place_name = name;
  return { title: data.place_name ?? "Reservation", body: state, data };
}

type Post = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean }>;

/** Three tries of the same body. The response is not logged. */
export async function deliverPush(tokens: string[], message: PushMessage, post: Post): Promise<boolean> {
  const live = tokens.filter((token) => token.length > 0);
  if (live.length === 0) return false;
  const body = JSON.stringify(live.map((to) => ({
    to,
    title: message.title,
    body: message.body,
    data: message.data,
  })));
  for (let attempt = 0; attempt < TRIES; attempt++) {
    try {
      const res = await post(EXPO_PUSH, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body,
      });
      if (res.ok) return true;
    } catch {
      // The next try uses the same body. The error is not logged: it can echo a token.
    }
  }
  return false;
}

type TokenRow = { token?: string | null };
type SendRow = { attempts?: number | null; sent_at?: string | null };

/** Send after the reservation row exists. A miss, a 'call' guest, or a dead
 *  provider leaves the reservation as it is. */
export async function sendReservationPush(admin: SupabaseClient, n: ReservationNotice): Promise<void> {
  try {
    if (await readConsumerNotify(admin, n.reservationId) !== "app") return;

    const prior = await admin
      .from("consumer_push_sends")
      .select("attempts, sent_at")
      .eq("reservation_id", n.reservationId)
      .eq("outcome", n.outcome)
      .maybeSingle();
    const row = prior.data as SendRow | null;
    if (prior.error || row?.sent_at || (row?.attempts ?? 0) >= TRIES) return;
    const attempts = (row?.attempts ?? 0) + 1;
    const saved = await admin.from("consumer_push_sends").upsert(
      { reservation_id: n.reservationId, outcome: n.outcome, attempts },
      { onConflict: "reservation_id,outcome" },
    );
    if (saved.error) return;

    const tokens = await admin
      .from("consumer_push_tokens")
      .select("token")
      .eq("consumer_id", n.consumerId);
    if (tokens.error) return;
    const list = ((tokens.data ?? []) as TokenRow[]).map((item) => item.token ?? "").filter((token) => token.length > 0);
    const sent = await deliverPush(list, reservationPushMessage(n.placeName, n.outcome), (url, init) => fetch(url, init));
    if (!sent) return;
    await admin.from("consumer_push_sends").update({ sent_at: new Date().toISOString() })
      .eq("reservation_id", n.reservationId)
      .eq("outcome", n.outcome);
  } catch {
    console.error(`[push] ${n.reservationId} not sent`);
  }
}
