// Admin preview of one Discovery signal. Scores come from the live functions.
// Name relevance embeds the query and the example names, then calls `name`.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  jsonError,
  jsonOk,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { embedBatch } from "../_shared/embeddings-http.ts";
import {
  previewEnrichment,
  previewFamily,
  previewName,
  previewPopularity,
  previewProximity,
  previewRandomness,
  previewTiming,
} from "../_shared/discovery-signal-preview.ts";

type Body = {
  signal?: unknown;
  maxKm?: unknown;
  samplesKm?: unknown;
  closedFloor?: unknown;
  asked?: unknown;
  families?: unknown;
  places?: unknown;
  seed?: unknown;
  count?: unknown;
  query?: unknown;
  names?: unknown;
};

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((
    item,
  ) => item.trim()).slice(0, 8);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const body = await readJsonOr<Body>(req, {});
  const signal = typeof body.signal === "string" ? body.signal : "";

  if (signal === "proximity") {
    const maxKm = num(body.maxKm, 25);
    const samples = Array.isArray(body.samplesKm)
      ? body.samplesKm.filter((item): item is number =>
        typeof item === "number"
      ).slice(0, 24)
      : [0, 1, 5, maxKm, maxKm + 10];
    const seen = previewProximity(maxKm, samples);
    return jsonOk({ rows: seen.rows, curve: seen.curve });
  }

  if (signal === "timing") {
    return jsonOk({ rows: previewTiming(num(body.closedFloor, 0.2)) });
  }

  if (signal === "family") {
    const asked = typeof body.asked === "string" && body.asked.trim()
      ? body.asked.trim()
      : "coffee";
    const places = Array.isArray(body.families)
      ? body.families.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as { label?: unknown; family?: unknown };
        const label = typeof row.label === "string" ? row.label : "Place";
        const family = typeof row.family === "string" ? row.family : null;
        return [{ label, family }];
      }).slice(0, 8)
      : [
        { label: "In the family", family: asked },
        { label: "Another family", family: "drinks" },
      ];
    return jsonOk({ rows: previewFamily(asked, places) });
  }

  if (signal === "popularity") {
    const places = Array.isArray(body.places)
      ? body.places.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as {
          label?: unknown;
          rating?: unknown;
          reviews?: unknown;
        };
        return [{
          label: typeof row.label === "string" ? row.label : "Place",
          rating: typeof row.rating === "number" ? row.rating : null,
          reviews: num(row.reviews, 0),
        }];
      }).slice(0, 8)
      : [
        { label: "5 from 3 reviews", rating: 5, reviews: 3 },
        { label: "4.6 from 900 reviews", rating: 4.6, reviews: 900 },
        { label: "No rating", rating: null, reviews: 0 },
      ];
    return jsonOk({ rows: previewPopularity(places) });
  }

  if (signal === "enrichment") {
    return jsonOk({
      rows: previewEnrichment([
        { label: "Enriched and ready", enriched: true, ready: true },
        { label: "Not enriched", enriched: false, ready: true },
      ]),
    });
  }

  if (signal === "randomness") {
    return jsonOk({
      rows: previewRandomness(
        Math.floor(num(body.seed, 1)),
        Math.min(8, Math.max(1, Math.floor(num(body.count, 5)))),
      ),
    });
  }

  if (signal === "name") {
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const names = textList(body.names);
    if (!query) {
      return jsonOk({
        rows: previewName(
          null,
          names.map((label) => ({ label, vector: null })),
        ),
      });
    }
    const apiKey = (Deno.env.get("OPENAI_KEY") ?? "").trim();
    if (!apiKey) {
      return jsonError("Name preview needs the embedding service.", 503);
    }
    try {
      const vectors = await embedBatch([query, ...names], apiKey);
      const queryVec = vectors[0] ?? null;
      const rows = previewName(
        queryVec,
        names.map((label, index) => ({
          label,
          vector: vectors[index + 1] ?? null,
        })),
      );
      return jsonOk({ rows });
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Name preview failed.";
      return jsonError(message, 502);
    }
  }

  return jsonError("Unknown signal.", 400);
});
