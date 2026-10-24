/** Pin names appear from this zoom (gate d4a). */
export const MAP_PIN_NAME_MIN_ZOOM = 14;

/** Haloed type sits just outside the 10px disk, to the right (MESITA-2748). */
const PIN_CLEARANCE_X = 12;
/** Keep two halos from kissing. */
const LABEL_GAP = 4;

export type PinLabelCandidate = {
  id: string;
  title: string;
  x: number;
  y: number;
  focused: boolean;
};

export type LabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function estimateLabelRect(x: number, y: number, title: string): LabelRect {
  const charW = 6.2;
  const height = 16;
  const maxWidth = 168;
  const width = Math.min(maxWidth, Math.max(24, title.length * charW + 4));
  const top = y - height / 2;
  const left = x + PIN_CLEARANCE_X;
  return { left, top, right: left + width, bottom: top + height };
}

function inflate(rect: LabelRect, gap: number): LabelRect {
  return {
    left: rect.left - gap,
    top: rect.top - gap,
    right: rect.right + gap,
    bottom: rect.bottom + gap,
  };
}

function intersects(a: LabelRect, b: LabelRect): boolean {
  return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
}

/** Focused (selected / held) pin always keeps its label; others skip on overlap. */
export function pickVisiblePinLabels(candidates: PinLabelCandidate[]): Set<string> {
  const sorted = [...candidates].sort((a, b) => {
    if (a.focused !== b.focused) return a.focused ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  const placed: LabelRect[] = [];
  const visible = new Set<string>();
  for (const c of sorted) {
    const rect = inflate(estimateLabelRect(c.x, c.y, c.title), LABEL_GAP);
    const blocked = placed.some((p) => intersects(rect, p));
    if (!blocked || c.focused) {
      visible.add(c.id);
      placed.push(rect);
    }
  }
  return visible;
}
