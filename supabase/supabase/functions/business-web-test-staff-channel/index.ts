// Supabase Edge Function — business-web-test-staff-channel
//
// "Send test ping" on the Team page / membership activation. Fires a WhatsApp
// (or mocked SMS) via Twilio staff sender. A successful WhatsApp send stamps
// projects.staff_channel_pinged_at and may flip membership live when the first
// ticket has already been honored (MESITA-542).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { recordStaffChannelPing } from "../_shared/membership-enforcement.ts";
import { readTwilioEnv, sendWhatsAppText } from "../_shared/twilio.ts";

type Body = {
  /** Canonical place-row id key (MESITA-26); `projectId` kept as legacy alias. */
  placeId?: string;
  projectId?: string;
  channel?: "whatsapp" | "sms";
  phone?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const projectId = readPlaceIdAlias(body);
  const channel = (body.channel ?? "whatsapp") as Body["channel"];
  const phone = (body.phone ?? "").trim();
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);
  if (channel !== "whatsapp" && channel !== "sms") {
    return json({ ok: false, error: "channel must be whatsapp or sms" }, 400);
  }
  if (!phone || !/^\+?\d{7,15}$/.test(phone.replace(/[^0-9+]/g, ""))) {
    return json({ ok: false, error: "phone must be E.164-ish (7–15 digits)" }, 400);
  }

  const admin = adminClient(envRes.env);
  const membership = await requireMembership(admin, authRes.user, projectId);
  if (!membership.ok) return membership.response;

  if (channel === "whatsapp") {
    const twilio = readTwilioEnv();
    if (twilio.ok) {
      const send = await sendWhatsAppText({
        env: twilio.env,
        from: twilio.env.whatsappFromStaff,
        to: phone,
        body:
          "Mesita — test ping ✓\n" +
          "Tu canal de WhatsApp del staff está conectado.\n" +
          "Cuando llegue un comensal, manda su código (0000-0000).",
      });
      if (send.ok) {
        const ping = await recordStaffChannelPing(admin, projectId);
        return json({
          ok: true,
          channel,
          to: phone,
          sent: true,
          mock: false,
          messageSid: send.sid,
          membership: ping.ok
            ? { pingRecorded: true, membershipLive: ping.membershipLive }
            : { pingRecorded: false, error: ping.error },
        });
      }
      return json(
        { ok: false, error: send.error, channel, to: phone },
        502,
      );
    }
  }

  // Mock path (Twilio missing, or SMS): still stamp the ping so activation
  // can proceed in non-Twilio envs / local mocks.
  const ping = await recordStaffChannelPing(admin, projectId);
  return json({
    ok: true,
    channel,
    to: phone,
    sent: false,
    mock: true,
    note: "Twilio not wired yet — message was not actually sent; ping stamped for activation.",
    membership: ping.ok
      ? { pingRecorded: true, membershipLive: ping.membershipLive }
      : { pingRecorded: false, error: ping.error },
  });
});
