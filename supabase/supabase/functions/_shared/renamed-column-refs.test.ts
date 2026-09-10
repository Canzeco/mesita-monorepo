// MESITA-1712 — no Edge Function may name a retired COLUMN in a query.
//
// `visit_tickets.project_id` became `place_id` (and `ticket_code` became
// `check_code`) in 20260825005000_rename_project_id_to_place_id.sql. Two raw
// selects were written after that migration and never got the memo:
//
//   stripe-webhook-handle-event/ticket-payment-intent.ts — the Mesita Pay
//   reliability backstop. It asked for `project_id`, PostgREST answered 42703
//   for the whole query, and the loader destructured `{ data }` alone — so the
//   error vanished and a null row read exactly like "already closed by the
//   synchronous path". The backstop silently never fired, the webhook answered
//   200, and a ticket stranded in `paying` by a crashed charge stayed there.
//
//   admin-web-review-ticket-report/index.ts — the same mistake against
//   `ticket_reports`. That one DID read `.error`, so every confirm and every
//   dismiss returned ok:false and operator triage was simply dead.
//
// The sibling guard `dropped-table-refs.test.ts` cannot catch either: it
// matches RELATION names against `.from("x")`, and `.from("visit_tickets")` is
// perfectly live. The bug is one line lower, in the column list.
//
// WHY THIS MATCHES QUERY SHAPES AND NOT THE BARE WORD. `project_id` is still
// the deliberate WIRE name in three places that must never be flagged: the
// document types (TicketDoc, ReservationDoc) and their patch-key sets, the
// write-door patches that `toPlaceIdPatch` translates on the way in, and the
// JSONB `payload` blobs on consumer_notifications that apps/web-consumer
// reads. `_shared/place-id.ts` is the one seam where the two names meet. So
// this guard matches only where a name reaches PostgREST as a COLUMN: a
// select's column list, and a filter's column argument. Everything else is
// the wire format doing its job.
//
// Comments are stripped before matching, because
// consumer-web-select-ticket-payment/index.ts explains this very rename in a
// comment sitting INSIDE its own `.select(...)` parentheses.

import { assertEquals } from "jsr:@std/assert@1";

/** Renamed columns. The old name is dead everywhere except the compat seam. */
const RETIRED_COLUMNS = ["project_id", "ticket_code"] as const;

/** Names this guard cannot judge: the seam itself, and this file. */
const EXEMPT = ["_shared/place-id.ts", "_shared/renamed-column-refs.test.ts"];

/** Filter methods whose FIRST argument is a column name. */
const COLUMN_FIRST_ARG =
  "eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|filter|order|match|not";

const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const e of Deno.readDirSync(dir)) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory) found.push(...walk(p));
    else if (p.endsWith(".ts")) found.push(p);
  }
  return found;
}

function edgeFunctionSources(): string[] {
  const out: string[] = [];
  for (const entry of Deno.readDirSync(FUNCTIONS_DIR)) {
    if (!entry.isDirectory) continue;
    out.push(...walk(`${FUNCTIONS_DIR}${entry.name}`));
  }
  return out;
}

/**
 * Blank out comments, preserving offsets and every string literal — a `//`
 * inside "https://…" is not a comment, and a column list inside a comment is
 * not a query.
 */
export function stripComments(src: string): string {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === "\\") i += 2;
        else if (src[i] === quote) { i++; break; }
        else i++;
      }
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

const RETIRED = RETIRED_COLUMNS.join("|");
/** A select whose column list is a literal: `.select("id, project_id")`. */
const SELECT_LITERAL = /\.select\(\s*(["'`])((?:\\.|[^\\])*?)\1/gs;
/** A filter naming the column directly: `.eq("project_id", …)`. */
const FILTER_COLUMN = new RegExp(
  `\\.(?:${COLUMN_FIRST_ARG})\\(\\s*["'\`](${RETIRED})["'\`]`,
  "g",
);
/** An identifier standing in for the column list: `.select(TICKET_COLUMNS)`. */
const SELECT_IDENT = /\.select\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;
/** …or interpolated into one: .select(`${PLACE_COLUMNS}, extra`). */
const SELECT_INTERP = /\.select\(\s*`[^`]*`/gs;
const INTERP_IDENT = /\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g;

function namesRetired(text: string): string | null {
  for (const col of RETIRED_COLUMNS) {
    if (new RegExp(`\\b${col}\\b`).test(text)) return col;
  }
  return null;
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

Deno.test("no Edge Function names a retired column in a query", () => {
  const offenders: string[] = [];

  for (const path of edgeFunctionSources()) {
    const rel = path.replace(FUNCTIONS_DIR, "");
    if (EXEMPT.some((e) => rel.endsWith(e))) continue;
    const src = stripComments(Deno.readTextFileSync(path));

    for (const m of src.matchAll(SELECT_LITERAL)) {
      const col = namesRetired(m[2]);
      if (col) {
        offenders.push(
          `${rel}:${lineOf(src, m.index!)} -> .select() names "${col}"`,
        );
      }
    }

    for (const m of src.matchAll(FILTER_COLUMN)) {
      offenders.push(
        `${rel}:${lineOf(src, m.index!)} -> filter names column "${m[1]}"`,
      );
    }

    // A column list hidden behind a constant is the same query, one hop away.
    const idents = new Set<string>();
    for (const m of src.matchAll(SELECT_IDENT)) idents.add(m[1]);
    for (const m of src.matchAll(SELECT_INTERP)) {
      for (const t of m[0].matchAll(INTERP_IDENT)) idents.add(t[1]);
    }
    for (const ident of idents) {
      const decl = new RegExp(
        `\\b(?:const|let|var)\\s+${ident}\\s*(?::[^=]+)?=([\\s\\S]*?);`,
      ).exec(src);
      const col = decl && namesRetired(decl[1]);
      if (col) {
        offenders.push(
          `${rel}:${lineOf(src, decl!.index)} -> ${ident} (a .select() argument) names "${col}"`,
        );
      }
    }
  }

  assertEquals(
    offenders,
    [],
    `These name a column the schema no longer has and will throw 42703 at runtime:\n  ${
      offenders.join("\n  ")
    }\n\nThe live columns are place_id and check_code. Select the real column and, if the caller must keep speaking the old name on the wire, remap the row through _shared/place-id.ts's fromPlaceIdRow().`,
  );
});
