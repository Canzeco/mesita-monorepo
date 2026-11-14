// Place notes (MESITA-3955): what Mesita has learned about how one place
// handles reservations, so the next call does not ask again.
//
// Pato, 2026-11-14: "call a is done, doc x is edited; call b starts, doc x is
// read at init for the agent ... dox x must not be a record of all the calls,
// it must be a summary of all the calls."
//
// One row per place in place_reservation_notes. After a finished call with
// the place (a1 out, a4 in), eleven-webhook-post-call hands the transcript
// here: a model REWRITES the notes from the old notes plus the transcript,
// under PLACE_NOTES_MAX_CHARS. The next call reads them (a1: the call variable
// venue_notes; a4: its caller check).
//
// The notes are Spanish because the agents that read them speak Spanish.
// They hold facts about the PLACE only: never a guest's name, phone or
// booking. What the owner set in Business › Reservations outranks them.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { openaiChat } from "./enrich-config.ts";
import { loadModelsConfig } from "./models-config.ts";

/** The notes' hard length limit. The table allows 1500; the model is asked
 *  for less and the result is cut here, so a long answer never fails a write. */
export const PLACE_NOTES_MAX_CHARS = 1200;

/** A transcript longer than this is cut from the middle: the opening and the
 *  ending of a call carry what matters. */
const TRANSCRIPT_MAX_CHARS = 12_000;

export const PLACE_NOTES_HEADINGS = [
  "Mesas",
  "Reglas para reservar",
  "Cómo contactarlos",
  "Otros",
] as const;

/** What a model answers when the call taught nothing new. */
export const NO_CHANGE = "SIN_CAMBIOS";

export const PLACE_NOTES_SYSTEM = [
  `Mantienes las notas de Mesita sobre cómo UN restaurante maneja sus reservaciones. Un agente de voz las lee antes de cada llamada con ese restaurante para no repetir preguntas.`,
  `Recibes las notas actuales y la transcripción de la llamada más reciente con el restaurante. Devuelve las notas COMPLETAS, reescritas: un resumen de todo lo aprendido, nunca una bitácora de llamadas.`,
  `Reglas:`,
  `- Solo hechos sobre el restaurante que su personal dijo en una llamada. No inventes ni deduzcas.`,
  `- Nunca datos de un comensal ni de una reservación en particular: ni nombres, ni teléfonos, ni fechas u horas de una reservación, ni códigos.`,
  `- Si la llamada contradice las notas, gana la llamada. Conserva lo que sigue siendo cierto.`,
  `- Máximo 900 caracteres. Frases cortas. Sin fechas de llamadas ni «en la última llamada».`,
  `- Usa exactamente estos encabezados, y omite el que no tenga nada:`,
  `Mesas: (interior, terraza, barra, privados, mesas grandes)`,
  `Reglas para reservar: (grupo máximo, anticipación, depósito o tarjeta, tolerancia, tiempo de mesa, horarios en que no reservan)`,
  `Cómo contactarlos: (mejor hora para llamar, quién toma reservaciones, menú telefónico, si prefieren otro medio)`,
  `Otros: (cualquier otra cosa que ahorre una pregunta la próxima vez)`,
  `- Si la llamada no enseñó nada nuevo sobre el restaurante (buzón, nadie contestó, solo se confirmó una mesa), responde exactamente ${NO_CHANGE}.`,
].join("\n");

type Turn = { role?: unknown; message?: unknown };

/**
 * The spoken turns of a call as plain text, or "" when the other side never
 * said anything (voicemail tones, a dropped call): nothing to learn from.
 */
export function transcriptText(transcript: unknown): string {
  const turns = Array.isArray(transcript) ? (transcript as Turn[]) : [];
  const lines: string[] = [];
  let otherSpoke = false;
  for (const t of turns) {
    const msg = typeof t?.message === "string" ? t.message.trim() : "";
    if (!msg) continue;
    if (t.role === "user") {
      otherSpoke = true;
      lines.push(`Restaurante: ${msg}`);
    } else if (t.role === "agent") {
      lines.push(`Mesita: ${msg}`);
    }
  }
  if (!otherSpoke) return "";
  const text = lines.join("\n");
  if (text.length <= TRANSCRIPT_MAX_CHARS) return text;
  const half = Math.floor(TRANSCRIPT_MAX_CHARS / 2);
  return `${text.slice(0, half)}\n[…]\n${text.slice(-half)}`;
}

/** The user message of the rewrite. */
export function rewritePrompt(currentNotes: string, transcript: string): string {
  return [
    `NOTAS ACTUALES:`,
    currentNotes.trim() || "(todavía no hay notas)",
    ``,
    `TRANSCRIPCIÓN DE LA LLAMADA MÁS RECIENTE:`,
    transcript,
  ].join("\n");
}

/**
 * What to store from the model's answer: null keeps the notes as they are
 * (nothing new, an empty answer, or the same text), else the new notes cut to
 * the limit on a line break where one exists.
 */
export function nextNotes(currentNotes: string, answer: string): string | null {
  const clean = answer.replace(/\r/g, "").trim();
  if (!clean || clean.toUpperCase().includes(NO_CHANGE)) return null;
  let out = clean;
  if (out.length > PLACE_NOTES_MAX_CHARS) {
    const cut = out.slice(0, PLACE_NOTES_MAX_CHARS);
    const lastBreak = cut.lastIndexOf("\n");
    out = (lastBreak > PLACE_NOTES_MAX_CHARS / 2 ? cut.slice(0, lastBreak) : cut).trim();
  }
  return out === currentNotes.trim() ? null : out;
}

/** The notes as one call variable: a single line, "" when there are none. */
export function notesForCall(notes: string | null | undefined): string {
  return (notes ?? "").replace(/\s*\n+\s*/g, " · ").trim();
}

/**
 * Which place a finished call was with, when it was a call with a place.
 * a1 calls belong to a reservation (the place is the ticket's); a4 calls are
 * known by the line the place phoned from. Any other agent: not a place call.
 */
export function placeCallKind(
  agentId: unknown,
  fleet: { a1?: string | null; a4?: string | null },
): "a1" | "a4" | null {
  if (typeof agentId !== "string" || !agentId.trim()) return null;
  const id = agentId.trim();
  if (fleet.a1 && id === fleet.a1) return "a1";
  if (fleet.a4 && id === fleet.a4) return "a4";
  return null;
}

/** The number an inbound call came from, as the post-call message carries it. */
export function callerNumber(data: Record<string, unknown> | null | undefined): string {
  const init = (data?.conversation_initiation_client_data ?? null) as Record<string, unknown> | null;
  const vars = (init?.dynamic_variables ?? null) as Record<string, unknown> | null;
  const fromVars = vars?.system__caller_id;
  if (typeof fromVars === "string" && fromVars.trim()) return fromVars.trim();
  const meta = (data?.metadata ?? null) as Record<string, unknown> | null;
  const call = (meta?.phone_call ?? null) as Record<string, unknown> | null;
  const external = call?.external_number;
  return typeof external === "string" ? external.trim() : "";
}

// ── Storage ────────────────────────────────────────────────────────────────

/** A place's notes, "" when it has none. A failed read is "" too: a call
 *  without notes is better than no call. */
export async function loadPlaceNotes(admin: SupabaseClient, placeId: string): Promise<string> {
  const { data, error } = await admin
    .from("place_reservation_notes")
    .select("notes")
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) {
    console.error(`[place-notes] load ${placeId}: ${error.message}`);
    return "";
  }
  return typeof data?.notes === "string" ? data.notes : "";
}

export type NotesUpdate =
  | { updated: true; chars: number }
  | { updated: false; reason: "nothing_said" | "same_call" | "no_key" | "model_failed" | "no_change" | "write_failed" };

/**
 * Rewrite one place's notes from a finished call. Never throws: the call's
 * outcome is already applied; the notes are extra.
 */
export async function updatePlaceNotes(
  admin: SupabaseClient,
  input: { placeId: string; conversationId: string; transcript: unknown },
): Promise<NotesUpdate> {
  const transcript = transcriptText(input.transcript);
  if (!transcript) return { updated: false, reason: "nothing_said" };

  const { data: row } = await admin
    .from("place_reservation_notes")
    .select("notes, calls, last_conversation_id")
    .eq("place_id", input.placeId)
    .maybeSingle();
  if (row?.last_conversation_id === input.conversationId) return { updated: false, reason: "same_call" };
  const current = typeof row?.notes === "string" ? row.notes : "";
  const calls = typeof row?.calls === "number" ? row.calls : 0;

  const key = Deno.env.get("OPENAI_KEY")?.trim() ?? "";
  if (!key) return { updated: false, reason: "no_key" };
  const { enricherModel } = await loadModelsConfig(admin);
  const res = await openaiChat({
    key,
    model: enricherModel,
    temperature: 0,
    maxTokens: 600,
    messages: [
      { role: "system", content: PLACE_NOTES_SYSTEM },
      { role: "user", content: rewritePrompt(current, transcript) },
    ],
  });
  if (!res.ok) {
    console.error(`[place-notes] model ${input.placeId}: ${res.status ?? "threw"}`);
    return { updated: false, reason: "model_failed" };
  }

  const notes = nextNotes(current, res.content);
  const { error } = await admin.from("place_reservation_notes").upsert({
    place_id: input.placeId,
    notes: notes ?? current,
    calls: calls + 1,
    last_conversation_id: input.conversationId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "place_id" });
  if (error) {
    console.error(`[place-notes] write ${input.placeId}: ${error.message}`);
    return { updated: false, reason: "write_failed" };
  }
  return notes === null ? { updated: false, reason: "no_change" } : { updated: true, chars: notes.length };
}
