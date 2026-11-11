// Supabase Edge Function — consumer-web-split-tab
//
// MESITA-3695 (Pay at the table, _shared/tab.ts): friends split one bill.
// On the guest's billed tab: split it (`ways` 2–20 and the guest's own
// `share_cents`) — the tab becomes the table, the guest gets a share, and a
// new join token comes back for the friends' QR (only its hash is stored, so
// each call rotates it); or stop splitting (`whole: true`) while no share is
// paying or paid. On a share: change its amount before paying
// (`share_cents` alone); it must fit in what is left.
//
// Body: { tab_id, ways, share_cents } | { tab_id, whole: true }
//       | { tab_id (a share), share_cents }
// Response: { ok: true, outcome: split | whole | share, share_tab_id?,
//             join_token?, left_cents?, bill_version? }
//   400 share_invalid · 401 sign_in · 404 not_found · 409 not_billed |
//   paying | expired | paid_part | share_too_big (+left_cents) | paid

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { failWithRequestId, json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { callTabRpc, hashJoinToken, hashTabToken, mintTabToken, readSplitTabBody, rpcRefusal } from "../_shared/tab.ts";

serveJson("consumer-web-split-tab", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to pay" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = readSplitTabBody(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, parsed.status);
  const input = parsed.input;

  try {
    let joinToken: string | null = null;
    let r: Record<string, unknown>;
    if (input.kind === "share") {
      r = await callTabRpc(admin, "pay_tab_set_share", { p_share_tab_id: input.tabId, p_consumer_id: user.id, p_share_cents: input.shareCents });
    } else if (input.kind === "whole") {
      r = await callTabRpc(admin, "pay_tab_split", {
        p_tab_id: input.tabId,
        p_consumer_id: user.id,
        p_ways: null,
        p_share_cents: null,
        p_join_token_hash: null,
        p_share_token_hash: null,
      });
    } else {
      joinToken = mintTabToken();
      r = await callTabRpc(admin, "pay_tab_split", {
        p_tab_id: input.tabId,
        p_consumer_id: user.id,
        p_ways: input.ways,
        p_share_cents: input.shareCents,
        p_join_token_hash: await hashJoinToken(joinToken),
        // The share's own token is never shown: nobody scans a share.
        p_share_token_hash: await hashTabToken(mintTabToken()),
      });
    }
    if (r.ok !== true) {
      const refusal = rpcRefusal(r);
      return json({ ok: false, code: refusal.code, error: refusal.error, ...refusal.detail }, refusal.status);
    }
    // Never the join token in a log line.
    console.log("[consumer-web-split-tab]", JSON.stringify({ outcome: r.outcome, tab_id: input.tabId, share_tab_id: r.share_tab_id ?? null }));
    return json({
      ok: true,
      outcome: r.outcome,
      share_tab_id: r.share_tab_id ?? null,
      join_token: r.outcome === "split" ? joinToken : null,
      left_cents: r.left_cents ?? null,
      bill_version: r.bill_version ?? null,
    });
  } catch (err) {
    return failWithRequestId("consumer-web-split-tab", "Couldn't split the bill. Try again.", err);
  }
});
