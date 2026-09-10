// _shared/config-section-verification.ts — the `verification` section's write.
//
// Was admin-web-update-verification-config (MESITA-1724 collapse). Writes the
// Verification Config knobs into app_config.verification_config (MESITA-1248
// fold of three loose scalar columns). Body: { config: { …partial knobs… } }
// — at least one boolean knob required. Returns the full config after write.
//
// Knobs:
//   createPlacesAsVerified — catalog Mesita Partner badge at create time
//   autoVerifyAiCall       — phone OTP auto-grants ownership
//   autoVerifyAiEmail      — email OTP auto-grants ownership
//
// `autoVerifyVideo` retired (MESITA-1248) — nothing ever read it.
// `admin-web-list-verifications` shows every video row regardless of the
// flag, and the console never rendered a control for it (see
// verification-config/VerificationConfigClient.tsx's own comment, which
// flagged this exact cleanup). `auto_verify_video` dropped in the same
// migration that removed it here.
//
// READ-MERGE-WRITE, not a blind jsonb replace — this is WHY the section owns
// its own write handler rather than riding the generic whole-blob path: the
// console genuinely saves one switch at a time
// (`updateVerificationConfig({ [key]: next })` on every flip, not a
// whole-object submit — VerificationConfigClient.tsx's own optimistic-save
// UX), so writing only the incoming key(s) as a fresh object would silently
// blank the other two on every toggle. This does reintroduce a lost-update
// race the old per-column `.update()` didn't have (two concurrent admin saves
// could clobber each other) — accepted deliberately: this page has exactly
// one operator (super-admin only), flips are rare, and the failure mode is
// "re-flip a switch", not data corruption or a security bypass. A true atomic
// merge would need a jsonb `||` RPC; not worth the extra surface for this risk
// profile.
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";
import type { ConfigSection, SectionWriteContext } from "./config-section-base.ts";
import { normalizeVerificationConfig } from "./verification-config.ts";

type ConfigPatch = {
  createPlacesAsVerified?: unknown;
  autoVerifyAiCall?: unknown;
  autoVerifyAiEmail?: unknown;
};

const KNOBS = [
  "createPlacesAsVerified",
  "autoVerifyAiCall",
  "autoVerifyAiEmail",
] as const;

export async function writeVerificationSection(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const patch = ctx.body.config as ConfigPatch | undefined;
  if (!patch || typeof patch !== "object") {
    return jsonError("config object required", 400);
  }

  const incoming: Partial<Record<typeof KNOBS[number], boolean>> = {};
  for (const key of KNOBS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      return jsonError(`config.${key} must be a boolean`, 400);
    }
    incoming[key] = value;
  }
  if (Object.keys(incoming).length === 0) {
    return jsonError(
      "config must include at least one of createPlacesAsVerified | autoVerifyAiCall | autoVerifyAiEmail",
      400,
    );
  }

  const current = await readAppConfig(
    ctx.admin,
    section.column,
    `${section.column}_read`,
  );
  if (!current.ok) return current.response;
  const merged = {
    ...normalizeVerificationConfig(current.row?.[section.column]),
    ...incoming,
  };

  const saved = await writeAppConfig(
    ctx.admin,
    { [section.column]: merged, updated_by: ctx.userId },
    `${section.column}, updated_at`,
    `${section.column}_update`,
  );
  if (!saved.ok) return saved.response;

  return jsonOk({
    config: normalizeVerificationConfig(saved.row[section.column]),
    updatedAt: saved.row.updated_at,
  });
}
