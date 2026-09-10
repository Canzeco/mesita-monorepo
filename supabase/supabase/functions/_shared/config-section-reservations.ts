// _shared/config-section-reservations.ts — the `reservations` section.
//
// Was admin-web-get-reservations-config / admin-web-update-reservations-config
// (MESITA-1724 collapse). The reservation-endpoint policy on
// app_config.reservations_config: the ordered channel priority (phone only —
// MESITA-842; voice-reachable), the parked channels, and whether an operator's
// hand-picked channel survives a re-enrich. See
// 20260715120000_reservations_config.sql +
// 20260805105000_reservations_phone_only.
//
// READ owns a handler because the page is fed by TWO queries — the policy, and
// the needs-attention feed below. WRITE owns one because its normalizer
// REFUSES rather than coerces (`priority` is an ordered list that must rank
// every channel; a partial merge of an ordering is meaningless), and the saved
// row is echoed raw rather than re-normalized.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import {
  appConfigMissing,
  type ConfigSection,
  type SectionWriteContext,
} from "./config-section-base.ts";
import { normalizeConfig } from "./reservations-config-normalize.ts";

export async function readReservationsSection(
  admin: SupabaseClient,
  section: ConfigSection,
): Promise<Response> {
  const res = await readAppConfig(
    admin,
    `${section.column}, updated_at`,
    section.readError ?? `${section.column}_read`,
  );
  if (!res.ok) return res.response;
  if (!res.row) return appConfigMissing();

  // ── Needs attention (eng-review 2026-08-04) ────────────────────────────────
  // The protocol exists because states nobody reads stop silently — this feed
  // is the reader. Every terminal-bad state a human must act on:
  //   · notice_state=failed      cancel notice never delivered (held table /
  //                              uninformed guest)
  //   · attempts_state=error     booking run died (platform outage persisted,
  //                              no number, crash)
  //   · callback_state=failed    guest leg could not be placed at all
  //   · confirmed-but-unheard    place said yes, the guest ladder ran dry and
  //                              nobody picked up — the table exists and its
  //                              owner doesn't know
  const { data: attention } = await admin
    .from("reservation_tickets")
    .select(
      "id, reference_code, state, reserved_at, last_call_state, notice_state, notice_kind, attempts_state, callback_state, reminder_state, consumer_confirmed_at, is_test",
    )
    .or(
      "notice_state.eq.failed," +
        "attempts_state.eq.error," +
        "callback_state.eq.failed," +
        "reminder_state.eq.failed," +
        "and(state.eq.confirmed,consumer_confirmed_at.is.null,callback_state.in.(no_answer,unknown),callback_next_attempt_at.is.null)",
    )
    .order("reserved_at", { ascending: false })
    .limit(30);

  return jsonOk({
    config: res.row[section.column],
    updatedAt: res.row.updated_at,
    needs_attention: attention ?? [],
  });
}

export async function writeReservationsSection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const norm = normalizeConfig(ctx.body.config);
  if (!norm.ok) return jsonError(norm.error, 400);

  const saved = await writeAppConfig(
    ctx.admin,
    { [section.column]: norm.value, updated_by: ctx.userId },
    `${section.column}, updated_at`,
    `${section.column}_update`,
  );
  if (!saved.ok) return saved.response;

  return jsonOk({
    config: saved.row[section.column],
    updatedAt: saved.row.updated_at,
  });
}
