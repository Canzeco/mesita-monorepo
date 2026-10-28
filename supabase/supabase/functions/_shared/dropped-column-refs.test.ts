// MESITA-2120 — no Edge Function may name a column the First Stage cut drops.
//
// MESITA-2091's migration (20261011014934_first_stage_schema_cut.sql) drops
// 66 columns off five tables and rebuilds the `profiles` view without them
// and without its four NULL placeholders. Several of those columns go ONLY
// because MESITA-2120 removes their last reader. Migrations apply on merge
// and Edge Functions deploy on their own, so a reader that survives is a
// 42703 on the consumer place screen, Search, reservations or the enricher
// the morning the migration lands — with every check green, because a
// PostgREST column list is a string and `deno check` cannot read it.
//
// `dropped-table-refs.test.ts` cannot see this: `.from("places")` is
// perfectly live, and the bug is one line lower. `renamed-column-refs.test.ts`
// is the shape this file copies, but it pins two RENAMED names with a compat
// seam to protect. These are dropped, so nothing is exempt.
//
// WHAT COUNTS AS NAMING A COLUMN. The places a name reaches PostgREST as a
// column, and nothing else:
//
//   - a `.select()` column list, embeds included, whether it is a literal or
//     a constant some hops away — `.select(PLACE_CARD_COLUMNS)` is followed
//     through `.join()`, spreads, `+` and imports to the array it came from;
//   - a filter's column — `.eq("plan", …)`, `.order(…)`, `.not(…)` — and the
//     `col.op.value` terms of an `.or(…)` string;
//   - a top-level key of what `.update()`, `.insert()`, `.upsert()` or
//     `.match()` sends, including keys assigned onto a local patch object
//     (`patch.orders_enabled = …`) before it is sent;
//   - a string in a column-list constant — a name ending in COLUMNS, COLS,
//     SELECT or PATCH_KEYS — whether or not a select reaches it today: a
//     door's patch keys are the columns it will write tomorrow.
//
// A JSONB key, a wire field, a destructured property and prose are not
// columns, and comments are blanked before any of this runs.
//
// TESTS ARE NOT SCANNED. A test that names a dropped column is asserting it is
// gone, and deploys nothing.
//
// SOME NAMES ARE AMBIGUOUS. `claimed_at` leaves `places` but stays on
// `reservation_tickets`, where the reservation call claims its row. A name in
// LIVE_ELSEWHERE is judged only where the statement's `.from()` says which
// table it is, so a column-list constant naming it is not judged at all.
//
// MESITA-2144 — the residue cut. A second exact list, RESIDUE_DROPPED_COLUMNS,
// names what the residue drops take off five tables. Its Edge Function half
// lands first, so this scan proves no deployed code still names one of them
// before any DROP applies. It shares the scan, not the counts: the First Stage
// list above stays the migration's own. Four of its names are live on another
// table — `state`, `phone`, `email`, `section` — and join LIVE_ELSEWHERE.
// `country` does not: both tables that carry it lose it, and the `profiles`
// view that projects it loses it with the view rebuild, so it is judged
// everywhere.
//
// WHY A NAME LIST AND NOT A SCHEMA DIFF: the same reason dropped-table-refs
// gives. The list is the migration's own, it is exact, and it cannot misfire
// on a column that exists.

import { assertEquals } from "jsr:@std/assert@1";

/** Exactly what 20261011014934_first_stage_schema_cut.sql drops, per table,
 *  in the migration's order. */
const DROPPED_COLUMNS = {
  places: [
    "claimed_by",
    "listing_type",
    "plan",
    "fiscal_type",
    "segmentation_basic_enabled",
    "segmentation_advanced_enabled",
    "welcome_free_rate",
    "welcome_premium_rate",
    "free_rate",
    "premium_rate",
    "monthly_promo_cap",
    "discount_cap_cents",
    "staff_channel_pinged_at",
    "first_ticket_honored_at",
    "plan_live_at",
    "strike_count",
    "last_strike_at",
    "promo_paused_until",
    "plan_forfeited_at",
    "check_pin",
    "reward_lane_pending_review_at",
    "claimed_at",
    "claim_reviewed_at",
    "claim_reviewed_by",
    "partnered",
    "legal_name",
    "rfc",
    "stripe_billing_customer_id",
  ],
  place_profiles: [
    "whatsapp_pr_urls",
    "instagram_pr_urls",
    "google_business_url",
    "google_visitor_count",
    "mesita_stars_overall",
    "mesita_stars_food",
    "mesita_stars_service",
    "mesita_stars_ambience",
    "mesita_stars_value",
    "mesita_review_count",
    "mesita_visitor_count",
    "description_es",
    "order_channel",
    "order_target",
    "orders_enabled",
    "mesita_pay_enabled",
    "credits_enabled",
    "pickup_orders_enabled",
    "delivery_orders_enabled",
  ],
  consumers: [
    "class_key",
    "invitation_class_key",
    "class_origin",
    "class_granted_at",
    "class_expires_at",
    "invitation_granted_at",
    "plan",
    "stripe_customer_id",
    "privacy_public",
    "privacy_show_saves",
    "privacy_show_visits",
    "privacy_show_stories",
  ],
  app_config: [
    "promos_config",
    "ojo_config",
    "orders_config",
    "visits_config",
    "controls_config",
    "verification_config",
  ],
  consumer_notifications: ["ticket_id"],
  // The view. Every other column it loses is a `places` or `place_profiles`
  // column above; these four were NULL / false placeholders that existed only
  // so pre-redeploy Edge Functions could still select them.
  profiles: ["tiktok_url", "tripadvisor_url", "yelp_url", "requires_story"],
} as const satisfies Record<string, readonly string[]>;

/** MESITA-2144 — exactly what the residue cut drops, per table. The
 *  `profiles` view's copies of the place_profiles names go with the view
 *  rebuild. */
const RESIDUE_DROPPED_COLUMNS = {
  place_profiles: [
    "vibe",
    "email",
    "country",
    "details",
    "editorial_summary",
    "established_year",
    "executive_chef",
    "facebook_rating",
    "enrich_every_days",
    "enrich_mode",
    "enrich_next_at",
  ],
  reservation_tickets: ["completed_at"],
  consumer_notifications: ["state", "resolved_at"],
  consumers: ["country"],
  super_admins: ["phone"],
  place_tags: ["section"],
} as const satisfies Record<string, readonly string[]>;

/** Dropped from one table, live on another: judged only with a known table.
 *  The value is where the name stays live. */
const LIVE_ELSEWHERE: Record<string, readonly string[]> = {
  claimed_at: ["reservation_tickets"],
  email: ["super_admins"],
  phone: ["consumers", "place_profiles", "profiles"],
  section: ["place_categories"],
  state: ["places", "profiles", "reservation_tickets"],
  plan: ["consumers"],
};

/** Dropped by a cut, then added back by a later migration. The cut lists stay
 *  the migrations' own; these come off the scan. */
const RESTORED: Record<string, readonly string[]> = {
  // MESITA-2548: consumers.plan is back (free or premium since MESITA-2560).
  consumers: ["plan"],
};

/** MESITA-2553 — `diamond` gave way to `guest_class` (Plan and Class). Its own
 *  list, so the two cut lists above stay their migrations' exact ones. */
const CLASS_PLAN_DROPPED_COLUMNS = {
  consumers: ["diamond"],
} as const satisfies Record<string, readonly string[]>;

/** MESITA-2791 — google_types[0] is Google's primary category (MESITA-2790);
 *  the separate column goes off the table and the view. */
const PRIMARY_TYPE_DROPPED_COLUMNS = {
  place_profiles: ["google_primary_type"],
  profiles: ["google_primary_type"],
} as const satisfies Record<string, readonly string[]>;

/** Every dropping table's columns, all cuts merged. */
const DROPPED_BY_TABLE = new Map<string, Set<string>>();
for (const list of [DROPPED_COLUMNS, RESIDUE_DROPPED_COLUMNS, CLASS_PLAN_DROPPED_COLUMNS, PRIMARY_TYPE_DROPPED_COLUMNS]) {
  for (const [table, cols] of Object.entries(list)) {
    const set = DROPPED_BY_TABLE.get(table) ?? new Set<string>();
    for (const col of cols) if (!RESTORED[table]?.includes(col)) set.add(col);
    DROPPED_BY_TABLE.set(table, set);
  }
}

const DROPPED = new Set<string>([...DROPPED_BY_TABLE.values()].flatMap((s) => [...s]));

/** Constants whose strings are column names by this codebase's convention. */
const COLUMN_LIST_NAME = /(?:COLUMNS|COLS|SELECT|PATCH_KEYS)(?:_ARRAY)?$/;

/** Filter methods whose FIRST argument is a column name. */
const FILTER_COLUMN =
  /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|textSearch|filter|order|not)\(\s*(["'`])([\w.]+)\1/g;

/** PostgREST operators an `.or()` term can carry after its column. */
const OR_TERM =
  /(?:^|[,(])\s*(?:not\.)?([a-z_][a-z0-9_]*)\.(?:eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs|cd|ov|sl|sr|nxl|nxr|adj|fts|plfts|phfts|wfts|match|imatch|isdistinct|not)\./g;

/** `root.key = …` / `root["key"] = …` on a root identifier, not `==` or `=>`. */
const ASSIGNED_KEY =
  /(?<![\w$.)\]])([A-Za-z_$][\w$]*)\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*["']([\w$]+)["']\s*\])\s*=(?![=>])/g;

/** `for (const <binding> of ` — the iterable and the body follow. */
const FOR_OF = /\bfor\s*\(\s*(?:const|let|var)\s+(\[[^\]]*\]|[A-Za-z_$][\w$]*)\s+of\s+/g;

const SCREAMING = /^[A-Z][A-Z0-9_]+$/;

const PACKAGE_DIR = new URL("../../../", import.meta.url).pathname;
const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;
const SCRIPTS_DIR = new URL("../../../scripts/", import.meta.url).pathname;

// ── Source handling ──────────────────────────────────────────────────────

/**
 * Blank out comments, preserving offsets and every string literal — a `//`
 * inside "https://…" is not a comment, and a column list inside a comment is
 * not a query. Duplicated from renamed-column-refs.test.ts on purpose:
 * importing a test file registers its tests a second time.
 */
function stripComments(src: string): string {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      while (i < stop) {
        if (src[i] !== "\n") out[i] = " ";
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join("");
}

/** From the quote at `i`, the index just past the closing quote. A template
 *  literal's `${…}` is skipped as code, nested strings included. */
function skipString(src: string, i: number): number {
  const quote = src[i];
  i++;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (quote === "`" && c === "$" && src[i + 1] === "{") {
      i = skipBalanced(src, i + 1);
      continue;
    }
    i++;
  }
  return i;
}

/** From the bracket at `i`, the index just past its match. */
function skipBalanced(src: string, i: number): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return i;
}

/** The expression from `start` to the first top-level `,`, `;` or unmatched
 *  closing bracket. */
function expressionAt(src: string, start: number): string {
  let i = start;
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(src, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    } else if ((c === "," || c === ";") && depth === 0) break;
    i++;
  }
  return src.slice(start, i);
}

/** The top-level parts of an object or array literal's body. */
function topLevelParts(literal: string): Array<{ text: string; at: number }> {
  const parts: Array<{ text: string; at: number }> = [];
  let depth = 0;
  let start = 1;
  let i = 1;
  while (i < literal.length - 1) {
    const c = literal[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(literal, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      parts.push({ text: literal.slice(start, i), at: start });
      start = i + 1;
    }
    i++;
  }
  parts.push({ text: literal.slice(start, literal.length - 1), at: start });
  return parts.filter((p) => p.text.trim() !== "");
}

type Literal = { body: string; at: number };

/** Every string literal in `expr` (template interpolations blanked) and every
 *  identifier that is not a property access, interpolations included. */
function harvest(expr: string, base: number): { strings: Literal[]; idents: string[] } {
  const strings: Literal[] = [];
  const idents: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === '"' || c === "'" || c === "`") {
      const end = skipString(expr, i);
      let body = expr.slice(i + 1, end - 1);
      if (c === "`") {
        for (const m of body.matchAll(/\$\{([^}]*)\}/g)) {
          idents.push(...harvest(m[1], 0).idents);
        }
        body = body.replace(/\$\{[^}]*\}/g, (m) => " ".repeat(m.length));
      }
      strings.push({ body, at: base + i + 1 });
      i = end;
      continue;
    }
    if (/\d/.test(c)) {
      while (i < expr.length && /[\w.]/.test(expr[i])) i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < expr.length && /[\w$]/.test(expr[j])) j++;
      const property = expr[i - 1] === "." && expr.slice(i - 3, i) !== "...";
      if (!property) idents.push(expr.slice(i, j));
      i = j;
      continue;
    }
    i++;
  }
  return { strings, idents };
}

/** The column names a select list (or a single column string) carries, with
 *  their offsets inside it. Aliases, casts, FK hints, spreads and JSON paths
 *  come off; embedded relation names ride along harmlessly. */
function columnsOf(list: string): Array<{ name: string; offset: number }> {
  const out: Array<{ name: string; offset: number }> = [];
  for (const m of list.matchAll(/[^,()]+/g)) {
    let token = m[0].replace(/^\s*\.\.\./, "").split("::")[0];
    const colon = token.lastIndexOf(":");
    if (colon >= 0) token = token.slice(colon + 1);
    token = token.split("!")[0].split("->")[0].trim();
    if (/^[a-z_][a-z0-9_]*$/.test(token)) {
      out.push({ name: token, offset: m.index! + m[0].indexOf(token) });
    }
  }
  return out;
}

// ── Files, declarations, imports ─────────────────────────────────────────

type Files = {
  /** Comment-stripped source by absolute path, or null when unreadable. */
  read(path: string): string | null;
  display(path: string): string;
};

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/") + 1);
}

function resolvePath(from: string, spec: string): string {
  const parts = (dirOf(from) + spec).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

type Decl = { file: string; rhs: string; rhsAt: number };

/** Every `const|let|var NAME … = RHS;` in one file. */
function declarationsIn(file: string, src: string, name: string): Decl[] {
  const out: Decl[] = [];
  const head = new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\b`, "g");
  for (const m of src.matchAll(head)) {
    let i = m.index! + m[0].length;
    let depth = 0;
    let eq = -1;
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'" || c === "`") {
        i = skipString(src, i);
        continue;
      }
      if (c === "(" || c === "[" || c === "{" || c === "<") depth++;
      else if (c === ")" || c === "]" || c === "}" || (c === ">" && src[i - 1] !== "=")) depth--;
      else if (c === ";" && depth <= 0) break;
      else if (
        c === "=" && depth === 0 && !"=>".includes(src[i + 1]) && !"=!<>".includes(src[i - 1])
      ) {
        eq = i;
        break;
      }
      if (depth < 0) break;
      i++;
    }
    if (eq === -1) continue;
    let j = eq + 1;
    depth = 0;
    while (j < src.length) {
      const c = src[j];
      if (c === '"' || c === "'" || c === "`") {
        j = skipString(src, j);
        continue;
      }
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) break;
        depth--;
      } else if (c === ";" && depth === 0) break;
      j++;
    }
    out.push({ file, rhs: src.slice(eq + 1, j), rhsAt: eq + 1 });
  }
  return out;
}

/** Where NAME is declared, as seen from FILE: locally, else through its
 *  imports (and one more hop through a re-export). */
function resolve(files: Files, file: string, name: string, hops = 0): Decl[] {
  const src = files.read(file);
  if (src === null || hops > 4) return [];
  const local = declarationsIn(file, src, name);
  if (local.length > 0) return local;
  const binding = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(binding)) {
    for (const spec of m[1].split(",")) {
      const [exported, local = exported] = spec.replace(/^\s*type\s+/, "").trim()
        .split(/\s+as\s+/);
      if (local.trim() === name && m[2].startsWith(".")) {
        return resolve(files, resolvePath(file, m[2]), exported.trim(), hops + 1);
      }
    }
  }
  return [];
}

// ── The scan ─────────────────────────────────────────────────────────────

type Report = (file: string, at: number, column: string, via: string, table: string | null) => void;

function droppedOn(column: string, table: string | null): boolean {
  if (!DROPPED.has(column)) return false;
  if (!(column in LIVE_ELSEWHERE)) return true;
  if (table === null) return false;
  return DROPPED_BY_TABLE.get(table)?.has(column) ?? false;
}

/** The table the statement around `index` reads from, when a literal says. */
function tableAt(src: string, index: number): string | null {
  const statement = src.slice(src.lastIndexOf(";", index) + 1, index);
  const froms = [...statement.matchAll(/\.from\(\s*["'`](\w+)["'`]\s*\)/g)];
  return froms.at(-1)?.[1] ?? null;
}

/** Follow a column-list expression to every string it is built from. */
function expandList(
  files: Files,
  file: string,
  expr: string,
  exprAt: number,
  via: string,
  table: string | null,
  report: Report,
  seen: Set<string>,
  anyIdent: boolean,
) {
  const { strings, idents } = harvest(expr, exprAt);
  for (const s of strings) {
    for (const col of columnsOf(s.body)) report(file, s.at + col.offset, col.name, via, table);
  }
  for (const ident of idents) {
    if (!anyIdent && !SCREAMING.test(ident)) continue;
    for (const decl of resolve(files, file, ident)) {
      const key = `${decl.file}#${decl.rhsAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      expandList(files, decl.file, decl.rhs, decl.rhsAt, `${via} via ${ident}`, table, report, seen, false);
    }
  }
}

/** Top-level keys of an object literal, or of each object in an array one. */
function writeKeys(literal: string, at: number): Array<{ name: string; at: number }> {
  const trimmed = literal.trimStart();
  const lead = literal.length - trimmed.length;
  const body = trimmed.trimEnd();
  if (body.startsWith("[")) {
    return topLevelParts(body).flatMap((p) => {
      const inner = p.text.trimStart();
      return inner.startsWith("{")
        ? writeKeys(inner, at + lead + p.at + (p.text.length - inner.length))
        : [];
    });
  }
  if (!body.startsWith("{")) return [];
  const keys: Array<{ name: string; at: number }> = [];
  for (const part of topLevelParts(body)) {
    const m = /^\s*(["']?)([A-Za-z_$][\w$]*)\1\s*(?::|$)/.exec(part.text);
    if (m) keys.push({ name: m[2], at: at + lead + part.at + part.text.indexOf(m[2]) });
  }
  return keys;
}

/**
 * Every place a source names a dropped column, as `path:line -> "col" (how)`.
 * One line per place: the first route the scan found to it is the one shown.
 */
function findDroppedColumnRefs(files: Files, paths: string[]): string[] {
  const hits = new Map<string, string>();
  const report: Report = (file, at, column, via, table) => {
    if (!droppedOn(column, table)) return;
    const src = files.read(file) ?? "";
    const where = `${files.display(file)}:${lineOf(src, at)} -> "${column}"`;
    if (!hits.has(where)) hits.set(where, `${where} (${via})`);
  };

  for (const file of paths) {
    const src = files.read(file);
    if (src === null) continue;

    for (const m of src.matchAll(/\.select\(/g)) {
      const at = m.index! + m[0].length;
      expandList(files, file, expressionAt(src, at), at, "select", tableAt(src, m.index!), report, new Set(), true);
    }

    for (const m of src.matchAll(FILTER_COLUMN)) {
      const column = m[2].split(".").at(-1)!;
      report(file, m.index! + m[0].lastIndexOf(m[2]) + m[2].length - column.length, column, "filter", tableAt(src, m.index!));
    }

    for (const m of src.matchAll(/\.or\(/g)) {
      const at = m.index! + m[0].length;
      for (const s of harvest(expressionAt(src, at), at).strings) {
        for (const t of s.body.matchAll(OR_TERM)) {
          report(file, s.at + t.index! + t[0].indexOf(t[1]), t[1], "filter", tableAt(src, m.index!));
        }
      }
    }

    // What a query or a door is handed to write: the argument of a write verb,
    // or the `patch:` a door call carries — a literal, or a local declared as
    // one.
    for (const m of src.matchAll(/\.(update|insert|upsert|match)\(|\bpatch\s*:/g)) {
      const at = m.index! + m[0].length;
      const via = m[1] ?? "patch";
      const arg = expressionAt(src, at).replace(/\s+as\s+[\s\S]*$/, "");
      const table = m[1] ? tableAt(src, m.index!) : null;
      for (const k of writeKeys(arg, at)) report(file, k.at, k.name, via, table);
      const ident = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(arg)?.[1];
      if (!ident) continue;
      for (const decl of declarationsIn(file, src, ident)) {
        for (const k of writeKeys(decl.rhs, decl.rhsAt)) {
          report(file, k.at, k.name, `${via} via ${ident}`, table);
        }
      }
    }

    // A patch built up a key at a time, which is how every door patch here is
    // built: `update.fiscal_type = f`, `place["orders_enabled"] = …`. Only the
    // root object counts — `sources.actions.orders_enabled` is a JSONB key.
    for (const a of src.matchAll(ASSIGNED_KEY)) {
      const key = a[2] ?? a[3];
      report(file, a.index! + a[0].lastIndexOf(key), key, `assigned onto ${a[1]}`, null);
    }

    // …or a column list walked into one: `for (const key of ["privacy_public",
    // …]) patch[key] = …`.
    for (const loop of src.matchAll(FOR_OF)) {
      const iterableAt = loop.index! + loop[0].length;
      const iterable = expressionAt(src, iterableAt);
      let bodyAt = iterableAt + iterable.length + 1;
      while (/\s/.test(src[bodyAt] ?? "")) bodyAt++;
      const body = src[bodyAt] === "{" ? src.slice(bodyAt, skipBalanced(src, bodyAt)) : "";
      const names = harvest(loop[1], 0).idents;
      const indexed = names.some((n) =>
        new RegExp(`(?:^|[^\\w$.])[A-Za-z_$][\\w$]*\\[\\s*${n.replace(/\$/g, "\\$")}\\s*\\]\\s*=(?![=>])`)
          .test(body)
      );
      if (!indexed) continue;
      for (const s of harvest(iterable, iterableAt).strings) {
        for (const col of columnsOf(s.body)) {
          report(file, s.at + col.offset, col.name, "column list walked into a patch", null);
        }
      }
    }

    for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
      if (!COLUMN_LIST_NAME.test(m[1])) continue;
      for (const decl of declarationsIn(file, src, m[1])) {
        expandList(files, file, decl.rhs, decl.rhsAt, `column list ${m[1]}`, null, report, new Set(), false);
      }
    }
  }
  return [...hits.values()].sort();
}

// ── The tree ─────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const found: string[] = [];
  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(dir)];
  } catch {
    return found;
  }
  for (const e of entries) {
    const p = `${dir.replace(/\/$/, "")}/${e.name}`;
    if (e.isDirectory) found.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) found.push(p);
  }
  return found;
}

function diskFiles(): Files {
  const cache = new Map<string, string | null>();
  return {
    read(path) {
      if (!cache.has(path)) {
        let src: string | null = null;
        try {
          src = stripComments(Deno.readTextFileSync(path));
        } catch {
          src = null;
        }
        cache.set(path, src);
      }
      return cache.get(path)!;
    },
    display: (path) => path.startsWith(PACKAGE_DIR) ? path.slice(PACKAGE_DIR.length) : path,
  };
}

function memoryFiles(sources: Record<string, string>): Files {
  return {
    read: (path) => path in sources ? stripComments(sources[path]) : null,
    display: (path) => path,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

Deno.test("DROPPED_COLUMNS is the migration's list, no more and no less", () => {
  const counts = Object.fromEntries(
    Object.entries(DROPPED_COLUMNS).map(([table, cols]) => [table, cols.length]),
  );
  assertEquals(counts, {
    places: 28,
    place_profiles: 19,
    consumers: 12,
    app_config: 6,
    consumer_notifications: 1,
    profiles: 4,
  });
  // "30 tables, 66 columns (consumer_notifications.ticket_id included)" — the
  // migration's own header. The view's four placeholders are not table columns.
  const tableColumns = Object.entries(DROPPED_COLUMNS)
    .filter(([table]) => table !== "profiles")
    .reduce((n, [, cols]) => n + cols.length, 0);
  assertEquals(tableColumns, 66);
  for (const [table, cols] of Object.entries(DROPPED_COLUMNS)) {
    assertEquals(new Set(cols).size, cols.length, `${table} lists a column twice`);
  }
});

Deno.test("CLASS_PLAN_DROPPED_COLUMNS is the MESITA-2553 drop, no more and no less", () => {
  assertEquals(CLASS_PLAN_DROPPED_COLUMNS, { consumers: ["diamond"] });
});

Deno.test("RESIDUE_DROPPED_COLUMNS is the MESITA-2144 cut, no more and no less", () => {
  const counts = Object.fromEntries(
    Object.entries(RESIDUE_DROPPED_COLUMNS).map(([table, cols]) => [table, cols.length]),
  );
  assertEquals(counts, {
    place_profiles: 11,
    reservation_tickets: 1,
    consumer_notifications: 2,
    consumers: 1,
    super_admins: 1,
    place_tags: 1,
  });
  for (const [table, cols] of Object.entries(RESIDUE_DROPPED_COLUMNS)) {
    assertEquals(new Set(cols).size, cols.length, `${table} lists a column twice`);
  }
  // A name live elsewhere is still dropped somewhere, and never from a table
  // it is listed as live on.
  for (const [col, liveOn] of Object.entries(LIVE_ELSEWHERE)) {
    assertEquals(DROPPED.has(col), true, `${col} is in LIVE_ELSEWHERE but dropped nowhere`);
    for (const table of liveOn) {
      assertEquals(DROPPED_BY_TABLE.get(table)?.has(col) ?? false, false, `${col} is live on ${table}`);
    }
  }
});

Deno.test("the scan fires on every shape it claims, and on nothing else", () => {
  const files = memoryFiles({
    "/v/_shared/cols.ts": [
      `const BASE: readonly string[] = ["id", "name", "listing_type"];`,
      `const EXTRA = ["order_target"];`,
      `export const PLACE_LIST = [...BASE, ...EXTRA, "updated_at"].join(", ");`,
      `export const CONSUMER_PATCH_KEYS = ["first_name", "privacy_public"] as const;`,
    ].join("\n"),
    "/v/fn/index.ts": [
      `import { PLACE_LIST } from "../_shared/cols.ts";`,
      `// .select("partnered") in a comment is prose`,
      `/* .eq("rfc", x) */`,
      `const url = "https://example.com/?plan=free";`,
      `const a = await admin.from("places").select("id, fiscal_type, profile:place_profiles!inner(id, mesita_pay_enabled)");`,
      `const b = await admin.from("places").select(PLACE_LIST).eq("plan", "free");`,
      `const c = await admin.from("profiles").select(\`\${PLACE_LIST}, yelp_url\`).order("strike_count");`,
      "const d = await admin.from(\"profiles\").select(\"id\").or(`name.ilike.x,partnered.is.true`);",
      `await admin.from("app_config").update({ ojo_config: {}, reservations_config: { plan: 1 } }).eq("id", 1);`,
      `await admin.from("consumer_notifications").insert([{ kind: "reservation", ticket_id: null }]);`,
      `const patch = { name: "x" };`,
      `patch.orders_enabled = true;`,
      `await admin.from("place_profiles").update(patch).eq("id", id);`,
      `await admin.from("reservation_tickets").update({ claimed_at: null }).eq("id", id);`,
      `await admin.from("places").update({ claimed_at: null }).eq("id", id);`,
      `const { tiktok_url: _drop, ...rest } = row;`,
      `const wire = { listing_type: rest.kind };`,
      `const update: Record<string, unknown> = {};`,
      `update.fiscal_type = "formal";`,
      `for (const [key, col] of [["reservation", "reservation_channel"], ["orders", "order_channel"]] as const) {`,
      `  update[col] = key;`,
      `}`,
      `await writePlace(admin, { table: "place_profiles", patch: update as ProfilePatch });`,
      `await writePlace(admin, { table: "place_profiles", patch: { orders_enabled: false } });`,
      `(sources.actions as Record<string, unknown>).credits_enabled = true;`,
      `sources.actions.pickup_orders_enabled = true;`,
    ].join("\n"),
  });
  const hits = findDroppedColumnRefs(files, ["/v/_shared/cols.ts", "/v/fn/index.ts"]);
  const named = hits.map((h) => h.replace(/ \(.*\)$/, ""));
  assertEquals(named, [
    `/v/_shared/cols.ts:1 -> "listing_type"`,
    `/v/_shared/cols.ts:2 -> "order_target"`,
    `/v/_shared/cols.ts:4 -> "privacy_public"`,
    `/v/fn/index.ts:10 -> "ticket_id"`,
    `/v/fn/index.ts:12 -> "orders_enabled"`,
    `/v/fn/index.ts:15 -> "claimed_at"`,
    `/v/fn/index.ts:19 -> "fiscal_type"`,
    `/v/fn/index.ts:20 -> "order_channel"`,
    `/v/fn/index.ts:24 -> "orders_enabled"`,
    `/v/fn/index.ts:5 -> "fiscal_type"`,
    `/v/fn/index.ts:5 -> "mesita_pay_enabled"`,
    `/v/fn/index.ts:6 -> "plan"`,
    `/v/fn/index.ts:7 -> "strike_count"`,
    `/v/fn/index.ts:7 -> "yelp_url"`,
    `/v/fn/index.ts:8 -> "partnered"`,
    `/v/fn/index.ts:9 -> "ojo_config"`,
  ]);
  // The constant two hops and one import away is reported where it lives,
  // and says how the select reached it.
  assertEquals(
    hits.some((h) => h.startsWith(`/v/_shared/cols.ts:1 -> "listing_type" (select via PLACE_LIST via BASE)`)),
    true,
    hits.join("\n"),
  );
});

Deno.test("the residue names judge by table where they are live elsewhere", () => {
  const files = memoryFiles({
    "/v/fn/index.ts": [
      `const PLACE_COLUMNS = ["id", "vibe", "email", "phone"];`,
      `await admin.from("super_admins").select("email, phone, user_id").eq("email", e);`,
      `await admin.from("consumers").select("id, phone, country");`,
      `await admin.from("place_tags").select("slug, section");`,
      `await admin.from("place_categories").select("slug, section").order("section");`,
      `await admin.from("consumer_notifications").select("id, state, resolved_at");`,
      `await admin.from("places").select("id, state").eq("state", "active");`,
      `await admin.from("place_profiles").update({ email: null, phone: "1" }).eq("id", id);`,
      `await admin.from("reservation_tickets").select("id, state, completed_at, confirmed_at");`,
    ].join("\n"),
  });
  const named = findDroppedColumnRefs(files, ["/v/fn/index.ts"]).map((h) => h.replace(/ \(.*\)$/, ""));
  assertEquals(named, [
    `/v/fn/index.ts:1 -> "vibe"`,
    `/v/fn/index.ts:2 -> "phone"`,
    `/v/fn/index.ts:3 -> "country"`,
    `/v/fn/index.ts:4 -> "section"`,
    `/v/fn/index.ts:6 -> "resolved_at"`,
    `/v/fn/index.ts:6 -> "state"`,
    `/v/fn/index.ts:8 -> "email"`,
    `/v/fn/index.ts:9 -> "completed_at"`,
  ]);
});

Deno.test("no Edge Function or script names a column the First Stage or residue cut drops", () => {
  const paths = [...walk(FUNCTIONS_DIR), ...walk(SCRIPTS_DIR)].sort();
  const offenders = findDroppedColumnRefs(diskFiles(), paths);
  assertEquals(
    offenders,
    [],
    `These name a column 20261011014934_first_stage_schema_cut.sql or the MESITA-2144 residue cut drops, and will throw 42703 once it applies:\n  ${
      offenders.join("\n  ")
    }\n\nRemove the column from the query, the patch and the column list together. If a column in DROPPED_COLUMNS or RESIDUE_DROPPED_COLUMNS is being kept after all, it comes out of the migration and its list in the same PR.`,
  );
});
