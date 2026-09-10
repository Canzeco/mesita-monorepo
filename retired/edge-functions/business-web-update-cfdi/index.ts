// ARCHIVED — a retired Edge Function, kept as a record. Not a module: nothing
// imports it, nothing builds it, and it is not deployable from here.
//
//   cloud slug     business-web-update-cfdi
//   cloud version  15
//   last deployed  2026-08-23
//   repo source    none. This function never existed in mesita-monorepo and
//                  carries no git history anywhere — a leftover from the
//                  pre-monorepo standalone repos, deployed to the singleton
//                  project and never undeployed.
//   retired by     MESITA-1722
//
// Captured verbatim from the Supabase Management API so the deletion stays
// recoverable, because git holds no other copy. Nothing in apps/ or
// supabase/ called it.
//
// It could not have run. The bundle is frozen at its 2026-08-23 deploy, so it
// still writes `public.projects`, renamed to `public.places` by MESITA-1590,
// and imports isRfcShaped / isMexicanPostalCode from _shared/input.ts, which
// no longer exports either. The `../_shared/*` paths below resolved against
// supabase/supabase/functions/_shared/ as it stood that day; they are recorded
// as written and do not resolve from this directory.
//
// This was the only writer of places.cfdi_rfc / cfdi_razon_social / cfdi_cp.
// Those three columns are dropped in the same issue that archived this file.
//
// ─────────────────────── original source below, verbatim ───────────────────

// Supabase Edge Function — business-web-update-cfdi (product caller)
//
// MESITA-1154 item 2: CFDI billing intake for the founding cohort — RFC /
// razón social / CP. Shape-validated only (RFC format, not SAT-verified).
// Intake only: this EF never generates an invoice and never talks to
// Facturama or any CFDI provider — founding cohort gets facturas manual,
// automate later.
//
// Deliberately self-contained and reads/writes public.projects directly
// (never public.profiles): the CFDI columns are not projected through that
// view yet — see the migration comment on 20260823092128_membership_golive_prep
// for why. So this EF does its own read-back instead of routing through
// business-web-update-project + PLACE_BUSINESS_COLUMNS.
//
// Body: { placeId | projectId, rfc?, razonSocial?, cp? }
//   • No cfdi fields present → read-only: returns whatever is on file.
//   • Any cfdi field present → validates + writes ALL THREE (whole-blob
//     save, same posture as the admin config pages) and returns the result.
// Response: { ok: true, cfdi: { rfc, razonSocial, cp } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireOwner } from "../_shared/auth.ts";
import { isMexicanPostalCode, isRfcShaped } from "../_shared/input.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  rfc?: unknown;
  razonSocial?: unknown;
  cp?: unknown;
};

type CfdiRow = {
  cfdi_rfc: string | null;
  cfdi_razon_social: string | null;
  cfdi_cp: string | null;
};

function toCfdi(row: CfdiRow) {
  return { rfc: row.cfdi_rfc, razonSocial: row.cfdi_razon_social, cp: row.cfdi_cp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const projectId = readPlaceIdAlias(body);
  if (!projectId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(
    admin,
    authRes.user,
    projectId,
    "Only owners can set billing details.",
  );
  if (!ownerRes.ok) return ownerRes.response;

  const wantsWrite = "rfc" in body || "razonSocial" in body || "cp" in body;

  if (!wantsWrite) {
    const read = await admin
      .from("projects")
      .select("cfdi_rfc, cfdi_razon_social, cfdi_cp")
      .eq("id", projectId)
      .maybeSingle();
    if (read.error) return json({ ok: false, error: `cfdi_read: ${read.error.message}` }, 500);
    if (!read.data) return json({ ok: false, error: "Place not found" }, 404);
    return json({ ok: true, cfdi: toCfdi(read.data as CfdiRow) });
  }

  // Whole-blob save: all three arrive together from one form, so partial
  // writes would let a client silently drop a field it didn't resend.
  const rfcRaw = typeof body.rfc === "string" ? body.rfc.trim().toUpperCase() : "";
  if (!isRfcShaped(rfcRaw)) {
    return json({ ok: false, error: "rfc must be a valid Mexican RFC (shape only)" }, 400);
  }
  const razonSocial = typeof body.razonSocial === "string" ? body.razonSocial.trim() : "";
  if (!razonSocial || razonSocial.length > 200) {
    return json(
      { ok: false, error: "razonSocial is required and must be 200 characters or fewer" },
      400,
    );
  }
  const cpRaw = typeof body.cp === "string" ? body.cp.trim() : "";
  if (!isMexicanPostalCode(cpRaw)) {
    return json({ ok: false, error: "cp must be a 5-digit Mexican postal code" }, 400);
  }

  const update = await admin
    .from("projects")
    .update({ cfdi_rfc: rfcRaw, cfdi_razon_social: razonSocial, cfdi_cp: cpRaw })
    .eq("id", projectId)
    .select("cfdi_rfc, cfdi_razon_social, cfdi_cp")
    .maybeSingle();
  if (update.error) return json({ ok: false, error: `cfdi_update: ${update.error.message}` }, 500);
  if (!update.data) return json({ ok: false, error: "Place not found" }, 404);

  return json({ ok: true, cfdi: toCfdi(update.data as CfdiRow) });
});
