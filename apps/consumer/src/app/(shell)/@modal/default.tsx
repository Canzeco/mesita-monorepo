// Parallel slot fallback. Returns null when no modal is active — required
// by Next.js so the @modal slot has something to render alongside
// {children} on every route that isn't matched by an interceptor.

export default function ModalDefault() {
  return null;
}
