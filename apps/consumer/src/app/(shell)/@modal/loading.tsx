// Modal-slot Suspense fallback. Returns null on purpose — when an
// intercepted route (e.g. /venues/[id] via @modal/(.)venues/[id]) is
// still loading, we DON'T want a visible spinner in the modal slot.
// The underlying surface (the discover deck the user tapped from)
// stays visible behind it; the moment the modal page resolves it
// slides in over the top with its own animation.
//
// Without this file, Next.js falls back to the closest parent loading
// boundary — which is (shell)/loading.tsx and replaces the children
// slot. That's wrong: while the modal is loading, the user is still
// looking at their previous surface, not at a spinner that obscures it.
export default function ModalLoading() {
  return null;
}
