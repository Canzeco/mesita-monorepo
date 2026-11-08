// A fake supabase-js client for the money tests (MESITA-3305): records every
// table operation and RPC, answers each from a handler the test writes.
// Only the chain the money modules use is modelled (from · select · insert ·
// update · delete · eq · in · is · not · order · limit · maybeSingle ·
// single · await). Test support only: nothing under functions/ imports it
// outside *.test.ts.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type FakeOp = {
  table: string;
  kind: "select" | "insert" | "update" | "delete";
  /** `.eq("a", 1)` → { a: 1 }; `.in("s", [..])` → { "s:in": [..] }; `.is("x", null)` → { "x:is": null }; `.not("x","is",null)` → { "x:not": "is:null" }. */
  filters: Record<string, unknown>;
  payload?: unknown;
  columns?: string;
  single?: boolean;
  count?: boolean;
};

export type FakeResult = { data?: unknown; error?: { code?: string; message: string } | null; count?: number | null };

export type FakeHandlers = {
  table: (op: FakeOp) => FakeResult | Promise<FakeResult>;
  rpc: (name: string, args: Record<string, unknown>) => FakeResult | Promise<FakeResult>;
};

class Builder implements PromiseLike<FakeResult> {
  private op: FakeOp;
  constructor(private readonly handle: FakeHandlers["table"], private readonly log: FakeOp[], table: string) {
    this.op = { table, kind: "select", filters: {} };
  }
  select(columns?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op.kind === "select") this.op.columns = columns;
    if (opts?.count) this.op.count = true;
    return this;
  }
  insert(payload: unknown) {
    this.op.kind = "insert";
    this.op.payload = payload;
    return this;
  }
  upsert(payload: unknown) {
    this.op.kind = "insert";
    this.op.payload = payload;
    return this;
  }
  update(payload: unknown) {
    this.op.kind = "update";
    this.op.payload = payload;
    return this;
  }
  delete() {
    this.op.kind = "delete";
    return this;
  }
  eq(k: string, v: unknown) {
    this.op.filters[k] = v;
    return this;
  }
  in(k: string, v: unknown) {
    this.op.filters[`${k}:in`] = v;
    return this;
  }
  is(k: string, v: unknown) {
    this.op.filters[`${k}:is`] = v;
    return this;
  }
  not(k: string, o: string, v: unknown) {
    this.op.filters[`${k}:not`] = `${o}:${String(v)}`;
    return this;
  }
  lt(k: string, v: unknown) {
    this.op.filters[`${k}:lt`] = v;
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    this.op.single = true;
    return this;
  }
  single() {
    this.op.single = true;
    return this;
  }
  then<T1 = FakeResult, T2 = never>(
    onfulfilled?: ((v: FakeResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((e: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    this.log.push(this.op);
    return Promise.resolve()
      .then(() => this.handle(this.op))
      .then((r) => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }))
      .then(onfulfilled, onrejected);
  }
}

export type FakeAdmin = {
  client: SupabaseClient;
  ops: FakeOp[];
  rpcs: Array<{ name: string; args: Record<string, unknown> }>;
};

export function fakeAdmin(handlers: Partial<FakeHandlers>): FakeAdmin {
  const ops: FakeOp[] = [];
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const table: FakeHandlers["table"] = handlers.table ?? (() => ({ data: null }));
  const rpc: FakeHandlers["rpc"] = handlers.rpc ?? (() => ({ data: { ok: true } }));
  const client = {
    from: (name: string) => new Builder(table, ops, name),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcs.push({ name, args });
      const r = await rpc(name, args);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  } as unknown as SupabaseClient;
  return { client, ops, rpcs };
}
