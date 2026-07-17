import type { SearchResponse } from "@/lib/places-types";

const SEARCH_CSV_HEADER =
  "query,place_id,name,address,rating,reviews,in_mesita,created_at,updated_at";

export function buildSearchCsvRows(result: SearchResponse): string[] {
  const rows: string[] = [SEARCH_CSV_HEADER];

  for (const q of result.queries) {
    for (const p of q.places) {
      rows.push(
        [
          q.query,
          p.id,
          p.displayName,
          p.formattedAddress,
          p.rating === null ? "" : String(p.rating),
          p.userRatingCount === null ? "" : String(p.userRatingCount),
          p.existsInMesita ? "yes" : "no",
          p.createdAt ?? "",
          p.updatedAt ?? "",
        ]
          .map(csvCell)
          .join(","),
      );
    }
  }

  return rows;
}

export function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
