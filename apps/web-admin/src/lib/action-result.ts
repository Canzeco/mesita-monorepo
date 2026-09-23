// The Result variant an EF-invoking server action returns when its failure is
// just a message. Failures that carry more (a code, a status) keep their own type.
export type ActionResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
