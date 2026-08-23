// _shared/doc-schema.ts
//
// Minimal hand-rolled runtime schema core (MESITA-1247). No zod: confirmed
// absent from this codebase (no import map, no "zod" hit anywhere under
// supabase/). This formalizes the {ok,value}|{ok,error} discriminated union
// already used ad hoc by every *-normalize.ts file into one composable, typed
// core instead of a seventh hand-rolled copy.
//
// NOT a zod clone: no .optional() with precise required/optional key
// inference, no coercion, no async validators, no chained refinements beyond
// one refine() wrapper. nullable() is this core's only way to mark a field
// that may be absent OR null — the two fold into one case (a missing key
// reads as null) rather than being tracked separately. Deliberate
// simplification sized to what this codebase's aggregates actually need.

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface Schema<T> {
  parse(raw: unknown): Result<T>;
}

/** The EF contract: `type X = Infer<typeof XSchema>` — never hand-typed. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

export function str(): Schema<string> {
  return {
    parse: (raw) =>
      typeof raw === "string"
        ? { ok: true, value: raw }
        : { ok: false, error: `expected string, got ${typeof raw}` },
  };
}

export function num(): Schema<number> {
  return {
    parse: (raw) =>
      typeof raw === "number" && !Number.isNaN(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: `expected number, got ${typeof raw}` },
  };
}

export function bool(): Schema<boolean> {
  return {
    parse: (raw) =>
      typeof raw === "boolean"
        ? { ok: true, value: raw }
        : { ok: false, error: `expected boolean, got ${typeof raw}` },
  };
}

export function literal<T extends string>(want: T): Schema<T> {
  return {
    parse: (raw) =>
      raw === want
        ? { ok: true, value: want }
        : { ok: false, error: `expected literal ${JSON.stringify(want)}` },
  };
}

export function enumOf<T extends readonly [string, ...string[]]>(
  values: T,
): Schema<T[number]> {
  return {
    parse: (raw) =>
      typeof raw === "string" && (values as readonly string[]).includes(raw)
        ? { ok: true, value: raw as T[number] }
        : {
          ok: false,
          error: `expected one of ${values.join("|")}, got ${JSON.stringify(raw)}`,
        },
  };
}

/** Absent-or-null both read as null — see header. Never `T | undefined`. */
export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return {
    parse: (raw) => {
      if (raw === null || raw === undefined) return { ok: true, value: null };
      return inner.parse(raw);
    },
  };
}

export function array<T>(inner: Schema<T>): Schema<T[]> {
  return {
    parse: (raw) => {
      if (!Array.isArray(raw)) {
        return { ok: false, error: `expected array, got ${typeof raw}` };
      }
      const out: T[] = [];
      for (let i = 0; i < raw.length; i++) {
        const r = inner.parse(raw[i]);
        if (!r.ok) return { ok: false, error: `[${i}]: ${r.error}` };
        out.push(r.value);
      }
      return { ok: true, value: out };
    },
  };
}

type Shape = Record<string, Schema<unknown>>;
type InferShape<S extends Shape> = { [K in keyof S]: Infer<S[K]> };

/**
 * The closed-key-set enforcer. A key on `raw` that isn't in `shape` is a
 * REJECT, not a silent drop — this is belt 2 of the two-belt pattern
 * (StampablePulseStep is belt 1's model): belt 1 is that `Infer<typeof
 * thisSchema>` is the only type a caller can construct a matching object
 * literal against, so a misspelled key fails to compile wherever the
 * inferred type is used as the EF's own working type; belt 2 is this
 * runtime rejection of a key that slipped past the type system (an `as`
 * cast, a JSON.parse of untrusted input, an LLM response).
 */
export function object<S extends Shape>(shape: S): Schema<InferShape<S>> {
  const keys = Object.keys(shape);
  return {
    parse: (raw) => {
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        return { ok: false, error: `expected object, got ${typeof raw}` };
      }
      const rawObj = raw as Record<string, unknown>;
      const unknownKeys = Object.keys(rawObj).filter((k) => !keys.includes(k));
      if (unknownKeys.length > 0) {
        return { ok: false, error: `unknown key(s): ${unknownKeys.join(", ")}` };
      }
      const value = {} as InferShape<S>;
      for (const key of keys) {
        const r = shape[key].parse(rawObj[key]);
        if (!r.ok) return { ok: false, error: `${key}: ${r.error}` };
        (value as Record<string, unknown>)[key] = r.value;
      }
      return { ok: true, value };
    },
  };
}

/** Cross-field invariant, applied only after every per-field check passes. */
export function refine<T>(
  schema: Schema<T>,
  check: (value: T) => string | null,
): Schema<T> {
  return {
    parse: (raw) => {
      const r = schema.parse(raw);
      if (!r.ok) return r;
      const problem = check(r.value);
      return problem ? { ok: false, error: problem } : r;
    },
  };
}
