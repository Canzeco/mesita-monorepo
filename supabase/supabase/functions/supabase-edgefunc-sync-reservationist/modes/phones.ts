// supabase-edgefunc-sync-reservationist · mode "phones".
//
// Import the two Twilio reservation lines and bind each to its inbound agent
// (place line → a4, guest line → a3). Idempotent.

import type { WorkspaceCtx } from "./context.ts";
import { elFetch } from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { consumerFromNumber, reservationFromNumber } from "../../_shared/elevenlabs.ts";

export async function phones(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, configuredAgents } = ctx;
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")?.trim();
  const token = Deno.env.get("TWILIO_AUTH_TOKEN")?.trim();
  if (!sid || !token) {
    return json({
      ok: false,
      error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured — needed to import",
    }, 503);
  }

  const businessLine = reservationFromNumber();
  const consumerLine = consumerFromNumber();
  if (consumerLine === businessLine) {
    return json({
      ok: false,
      error:
        "ELEVENLABS_CONSUMER_FROM_NUMBER is unset, so both audiences resolve to " +
        `${businessLine}. Set it before binding — a3 and a4 cannot share a line.`,
    }, 400);
  }

  const want = [
    {
      key: "a4",
      e164: businessLine,
      label: "Mesita Reservations (Businesses)",
      agentId: configuredAgents.a4?.id?.trim() ?? "",
    },
    {
      key: "a3",
      e164: consumerLine,
      label: "Mesita Reservations (Consumers)",
      agentId: configuredAgents.a3?.id?.trim() ?? "",
    },
  ];
  const missingAgent = want.filter((w) => !w.agentId).map((w) => w.key);
  if (missingAgent.length > 0) {
    return json({
      ok: false,
      error: `agents_config.agents is missing ${missingAgent.join(", ")} — run mode "fleet" first`,
    }, 400);
  }

  const listed = await elFetch(key, "/v1/convai/phone-numbers");
  if (!listed.ok) return json({ ok: false, error: listed.error }, 502);
  const existing = Array.isArray(listed.body)
    ? (listed.body as Array<Record<string, unknown>>)
    : [];
  const digits = (v: string) => v.replace(/[^\d+]/g, "");
  const findRow = (e164: string) =>
    existing.find((row) =>
      typeof row.phone_number === "string" && digits(row.phone_number) === digits(e164)
    ) ?? null;

  const actions: Array<Record<string, unknown>> = [];
  for (const w of want) {
    const row = findRow(w.e164);
    if (!row) {
      // Not imported yet. NOTE: importing takes over this number's Twilio
      // voice webhook — intended, that is what makes ElevenLabs answer it.
      const created = await elFetch(key, "/v1/convai/phone-numbers", {
        method: "POST",
        body: {
          phone_number: w.e164,
          label: w.label,
          sid,
          token,
          provider: "twilio",
          agent_id: w.agentId,
        },
      });
      if (!created.ok) {
        return json({ ok: false, error: `import ${w.e164}: ${created.error}`, actions }, 502);
      }
      actions.push({ number: w.e164, agent: w.key, action: "imported+bound" });
      continue;
    }

    const id = typeof row.phone_number_id === "string" ? row.phone_number_id : "";
    const boundTo = typeof row.assigned_agent === "object" && row.assigned_agent !== null
      ? (row.assigned_agent as { agent_id?: string }).agent_id ?? null
      : (typeof row.agent_id === "string" ? row.agent_id : null);
    if (boundTo === w.agentId) {
      actions.push({ number: w.e164, agent: w.key, action: "already correct" });
      continue;
    }
    if (!id) {
      return json({
        ok: false,
        error: `${w.e164} is imported but carries no phone_number_id — cannot re-bind`,
        actions,
      }, 502);
    }
    const patched = await elFetch(
      key,
      `/v1/convai/phone-numbers/${encodeURIComponent(id)}`,
      { method: "PATCH", body: { agent_id: w.agentId } },
    );
    if (!patched.ok) {
      return json({ ok: false, error: `bind ${w.e164}: ${patched.error}`, actions }, 502);
    }
    actions.push({
      number: w.e164,
      agent: w.key,
      action: "re-bound",
      was: boundTo,
    });
  }

  const after = await elFetch(key, "/v1/convai/phone-numbers");
  return json({
    ok: true,
    mode,
    business_line: businessLine,
    consumer_line: consumerLine,
    actions,
    phone_numbers: after.ok ? after.body : null,
  });
}
