// Open-redirect guard for `?next=` params. Accepts only same-origin
// paths (lead with "/", reject "//" which would escape the origin).
export function safeNext(raw: string | undefined): string {
  if (!raw) return "/";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}
