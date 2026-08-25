import { FAMILIES, type FamilyKey } from "./catalog";

// One cell, one scan. The matrix used to print six chips on every row; the
// operator only needs to know whether a channel is all families, some, or none.

export function familySummary(selected: readonly FamilyKey[]): {
  kind: "all" | "none" | "some";
  label: string;
} {
  const on = new Set(selected);
  if (on.size === 0) return { kind: "none", label: "none" };
  if (FAMILIES.every((f) => on.has(f.key))) {
    return { kind: "all", label: "all" };
  }
  return { kind: "some", label: `${on.size} of ${FAMILIES.length}` };
}
