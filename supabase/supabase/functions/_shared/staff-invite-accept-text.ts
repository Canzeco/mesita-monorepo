/** Guest/staff accept keywords and accepted reply (no links). */

export function isStaffInviteAcceptMessage(body: string): boolean {
  const t = body.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!t) return false;
  const words = new Set(
    t.split(/[\s,.!?;:]+/).filter((w) => w.length > 0),
  );
  const accept = new Set([
    "si",
    "sí",
    "yes",
    "y",
    "acepto",
    "accept",
    "ok",
    "vale",
    "listo",
    "dale",
    "va",
    "claro",
    "entro",
    "quiero",
  ]);
  if (/^(si|sí)\s*(quiero|acepto|gracias)?\b/.test(t)) return true;
  if (words.size <= 3) {
    for (const w of words) {
      if (accept.has(w)) return true;
    }
  }
  if (/^(si|yes|acepto|accept|ok|vale|listo)\b/.test(t)) return true;
  return false;
}

export function buildStaffInviteAcceptedReply(placeName: string): string {
  return (
    `Perfecto — ya quedaste en ${placeName}.\n\n` +
    `Cuando tengas un comensal, manda su código Mesita (0000-0000) y después la cuenta ` +
    `(por ejemplo SUBTOTAL 850 PROPINA 100). Cuando cobres, responde listo.\n\n` +
    `Escribe ayuda cuando quieras un recordatorio.`
  );
}
