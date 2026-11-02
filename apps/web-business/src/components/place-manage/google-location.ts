// The Location card shows Google's formatted address and nothing else.
// Address components and coordinates stay in the stored blob; the map
// reads lat/lng off the place row. formattedAddress is never split.

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function googleFormattedAddress(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return text((raw as { formattedAddress?: unknown }).formattedAddress);
}
