// Blob-normalizer clamp primitives. They live here because a "use server"
// actions.ts may export only async functions, and supabase-ef.ts is generated.
// Mirrors num/bool in supabase/functions/_shared/config-coerce.ts; change both.

export function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}
