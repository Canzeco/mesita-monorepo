import { assert, assertEquals } from "jsr:@std/assert@1";
import { array, enumOf, nullable, num, object, refine, str, type Infer } from "./doc-schema.ts";

Deno.test("object(): accepts a matching shape", () => {
  const S = object({ name: str(), age: nullable(num()) });
  assert(S.parse({ name: "a", age: 5 }).ok);
  assert(S.parse({ name: "a", age: null }).ok);
});

Deno.test("object(): rejects an unknown key (closed key set)", () => {
  const S = object({ name: str() });
  const r = S.parse({ name: "a", extra: "nope" });
  assert(!r.ok);
  if (!r.ok) assert(r.error.includes("extra"));
});

Deno.test("object(): rejects a missing required key", () => {
  const r = object({ name: str() }).parse({});
  assert(!r.ok);
});

Deno.test("nullable(): absent and explicit null both parse to null", () => {
  const S = object({ age: nullable(num()) });
  const a = S.parse({});
  const b = S.parse({ age: null });
  assert(a.ok && a.value.age === null);
  assert(b.ok && b.value.age === null);
});

Deno.test("array(): rejects a bad element with its index in the error", () => {
  const r = array(num()).parse([1, 2, "x"]);
  assert(!r.ok);
  if (!r.ok) assert(r.error.startsWith("[2]"));
});

Deno.test("enumOf(): rejects a value outside the closed set", () => {
  const S = enumOf(["a", "b"] as const);
  assert(!S.parse("c").ok);
  assert(S.parse("a").ok);
});

Deno.test("refine(): cross-field invariant runs only after per-field checks pass", () => {
  const S = refine(
    object({ min: num(), max: num() }),
    (v) => (v.min <= v.max ? null : "min must be <= max"),
  );
  assert(S.parse({ min: 1, max: 2 }).ok);
  assert(!S.parse({ min: 5, max: 2 }).ok);
  assert(!S.parse({ min: "x", max: 2 }).ok); // per-field error, refine never runs
});

Deno.test("Infer<> is the compile-time belt", () => {
  const S = object({ n: str() });
  type T = Infer<typeof S>;
  const ok: T = { n: "fine" };
  // @ts-expect-error — an unknown key must fail to compile against Infer<>
  const _bad: T = { n: "fine", extra: 1 };
  assertEquals(ok.n, "fine");
});
