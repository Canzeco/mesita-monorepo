// Supabase Edge Function — consumer-web-signin-phone
//
// Post-sign-in housekeeping for every consumer sign-in method: phone code,
// Continue with Google, email code (MESITA-3777). Auth already landed a
// session; this stamps app_metadata.role (never downgrading staff, business
// or admin) and makes the consumers row on first sign-in. The decisions live
// in signin.ts; this file wires them to the database.
//
// Self-contained: the consumer door verifies the JWT; own DB writes via the service role.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
import { ensureConsumer } from "../_shared/business-request.ts";
import { handleSignin, type SigninRow } from "./signin.ts";

const SIGNIN_SELECT =
  "id, code, full_name, first_name, last_name, phone, birthday, sex, deleted_at";

serveJson("consumer-web-signin-phone", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const appMetadata = (user.raw.app_metadata ?? null) as Record<string, unknown> | null;

  const reply = await handleSignin(
    { id: user.id, email: user.email, phone: user.phone, appMetadata },
    {
      stampRole: async (role) => {
        const res = await admin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...(appMetadata ?? {}), role },
        });
        return res.error ? { ok: false, error: res.error.message } : { ok: true };
      },
      createRow: async () => {
        const res = await ensureConsumer(admin, user);
        return res.ok ? { ok: true } : res;
      },
      readRow: async () => {
        const res = await admin.from("consumers").select(SIGNIN_SELECT).eq("id", user.id).maybeSingle();
        return res.error ? { ok: false, error: res.error.message } : { ok: true, row: res.data as SigninRow | null };
      },
      syncPhone: async (phone) => {
        const res = await writeConsumer(admin, {
          mode: "update",
          id: user.id,
          patch: { phone },
          select: SIGNIN_SELECT,
        });
        return res.ok ? { ok: true, row: res.row as SigninRow } : { ok: false, error: res.error };
      },
      log: (line) => console.log(line),
    },
  );
  return json(reply.body, reply.status);
});
