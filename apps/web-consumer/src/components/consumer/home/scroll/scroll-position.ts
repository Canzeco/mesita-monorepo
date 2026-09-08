// Scroll's position across a mode switch.
//
// Home's four modes are siblings under one layout, so Next keeps the LAYOUT
// mounted and unmounts the leaf page. Scroll → Feed → Scroll therefore
// remounts this list at row 0 unless the offset is stored somewhere outside
// React. The card-stack deck had the same problem and solved it by storing
// which places had been seen; a scroll has no "seen", only an offset.
//
// sessionStorage, not localStorage: coming back to Home tomorrow should start
// at the top of a freshly ranked deck, not halfway down yesterday's.

const KEY = "mesita:scroll-position";

export function readScrollPosition(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return 0;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeScrollPosition(offset: number) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, String(Math.max(0, Math.round(offset))));
  } catch {
    // Private mode / quota. Losing the position is a smaller cost than
    // throwing inside a scroll handler.
  }
}
