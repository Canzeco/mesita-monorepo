// Reply/copy + place-picker parse helpers for staff WhatsApp sessions.

import { displayConsumerCode } from "./consumer-code.ts";
import type {
  SessionRow,
  StaffContext,
  StaffPlace,
} from "./staff-whatsapp-types.ts";

export function prefixActivePlace(staff: StaffContext): string {
  return `Unidad: ${staff.placeName}\n`;
}

export function idleOpsBlockedReminder(
  staff: StaffContext,
  session: SessionRow,
  opsMessage: string,
): string {
  const code = session.pending_consumer_code
    ? displayConsumerCode(session.pending_consumer_code)
    : null;
  const preview = session.context?.consumer_preview as
    | { name?: string }
    | undefined;
  const name = preview?.name;
  let msg = `Unidad: ${staff.placeName}\n`;
  if (code && name) msg += `Último comensal: ${name} (${code})\n`;
  msg +=
    `\nNo puedes abrir ticket con descuento todavía:\n${opsMessage}\n\n` +
    `Manda otro código cuando esté listo, o escribe ayuda.`;
  return msg;
}

export function helpText(
  state: string,
  staff: StaffContext,
  places: StaffPlace[],
  canSwitch: boolean,
): string {
  const switchLine = canSwitch
    ? "cambiar unidad — otro local (solo sin comensal activo)\n"
    : "";
  switch (state) {
    case "selecting_project":
      return placePickerText(places);
    case "consumer_identified":
      return (
        prefixActivePlace(staff) +
        "Manda la cuenta en un mensaje o en varios:\n" +
        "• SUBTOTAL 850 y después PROPINA 100\n" +
        "• o 850 y luego 100\n" +
        "Montos en pesos. Escribe cancelar para empezar de nuevo."
      );
    case "awaiting_staff_payment_confirm":
      return prefixActivePlace(staff) +
        "Cuando el comensal haya pagado su parte, responde listo o sí.";
    default:
      return (
        prefixActivePlace(staff) +
        "Mesita Ops — ticket con descuento (tipo A)\n" +
        "1) Código del comensal (0000-0000)\n" +
        "2) SUBTOTAL y PROPINA por WhatsApp\n" +
        "3) El comensal recibe la cuenta en la app → Pay y confirma ahí\n" +
        "4) Tú respondes listo cuando cobres\n" +
        switchLine +
        "cancelar — reinicia la sesión del comensal (mantienes esta unidad)."
      );
  }
}

export function placePickerText(places: StaffPlace[]): string {
  const lines = places.map((v, i) => `${i + 1}) ${v.placeName}`);
  return (
    "Trabajas en varios locales de Mesita.\n" +
    "¿En cuál estás hoy? (un WhatsApp = una unidad activa):\n\n" +
    lines.join("\n") +
    "\n\nResponde con el número (ej. 1) o el nombre del lugar.\n" +
    "Después puedes escribir cambiar unidad cuando no tengas un comensal activo."
  );
}

export function isSwitchPlaceCommand(body: string): boolean {
  return /^(switch|cambiar(\s+unidad)?|unidad|sucursal|place|unit)\b/i.test(
    body.trim(),
  );
}

export function parsePlaceSelection(body: string, places: StaffPlace[]): string | null {
  const t = body.trim();
  if (!t) return null;

  const numOnly = t.match(/^(\d+)$/);
  if (numOnly) {
    const idx = Number(numOnly[1]) - 1;
    if (idx >= 0 && idx < places.length) return places[idx].projectId;
  }

  const numPrefix = t.match(/^(?:place|unidad|sucursal|unit)\s*#?\s*(\d+)/i);
  if (numPrefix) {
    const idx = Number(numPrefix[1]) - 1;
    if (idx >= 0 && idx < places.length) return places[idx].projectId;
  }

  const lower = t.toLowerCase();
  for (const v of places) {
    const name = v.placeName.toLowerCase();
    if (lower === name || lower.includes(name) || name.includes(lower)) {
      return v.projectId;
    }
  }
  return null;
}
