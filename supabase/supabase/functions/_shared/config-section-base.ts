// _shared/config-section-base.ts
//
// The contract every admin config section shares, plus the two default
// behaviours most of them are: read the section's jsonb column and hand back
// the normalized blob, or normalize the whole blob the console sent and write
// it back.
//
// Ten sections live on app_config, and the premise that they were the same
// function ten times is FALSE — four of the writes carry real per-section
// validation (verification's read-merge-write, models' structural rebuild,
// rewards' v12 blob and its stale-save 409, the enricher's twenty-odd ranged
// knobs and its image-funnel lock). So a section DECLARES its column and its
// normalizer here and MAY override read, write, or both with its own module.
// The uniform six are one registry line each; nothing is flattened into an
// if/else and nothing is dropped because "the generic path covers it".
//
// Lives apart from config-sections.ts (the registry) only to keep the imports
// acyclic: the section modules import this, the registry imports them.
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { jsonError, jsonOk } from "./http.ts";
import { readAppConfig, writeAppConfig } from "./write-config.ts";

/** What a per-section write handler is handed. */
export type SectionWriteContext = {
  admin: SupabaseClient;
  /** auth.users id of the super-admin saving — lands in app_config.updated_by. */
  userId: string;
  /** The whole parsed request body, `section` included. */
  body: Record<string, unknown>;
};

export type ConfigSection = {
  /** The app_config jsonb column this section owns. */
  column: string;
  /** Raw jsonb -> the shape the console renders. */
  normalize: (raw: unknown) => unknown;
  /** Prefix on a failed read. Defaults to `<column>_read`. */
  readError?: string;
  /** Whole-section read. Defaults to `readSectionColumn` below. */
  read?: (
    admin: SupabaseClient,
    section: ConfigSection,
  ) => Promise<Response>;
  /** Whole-section write. Defaults to `writeSectionColumn` below. */
  write?: (
    ctx: SectionWriteContext,
    section: ConfigSection,
  ) => Promise<Response>;
};

/** The 500 every section returns when the singleton row itself is gone. */
export function appConfigMissing(): Response {
  return jsonError("app_config missing", 500);
}

/** The default read: `{ ok, config: normalize(column), updatedAt }`. */
export async function readSectionColumn(
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
  return jsonOk({
    config: section.normalize(res.row[section.column]),
    updatedAt: res.row.updated_at,
  });
}

/**
 * The default write: WHOLE-BLOB. Every one of these sections holds a related
 * set of knobs (a ceiling that can never sit below its floor, an ordered list,
 * exponents that only mean anything against each other), so the console sends
 * the complete policy and the normalizer rebuilds it — a per-key merge could
 * persist half a rebalance nobody designed.
 */
export async function writeSectionColumn(
  ctx: SectionWriteContext,
  section: ConfigSection,
): Promise<Response> {
  const next = section.normalize(ctx.body.config);
  const res = await writeAppConfig(
    ctx.admin,
    { [section.column]: next, updated_by: ctx.userId },
    `${section.column}, updated_at`,
    `${section.column}_update`,
  );
  if (!res.ok) return res.response;
  return jsonOk({
    config: section.normalize(res.row[section.column]),
    updatedAt: res.row.updated_at,
  });
}
