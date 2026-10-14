/** First workspace name from GET /v1/owners. The list item may nest `owner`. */
export function renderWorkspaceName(body: unknown): string | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const first = body[0];
  if (!first || typeof first !== "object") return null;
  const row = first as { name?: unknown; owner?: { name?: unknown } };
  const name = row.owner?.name ?? row.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}
