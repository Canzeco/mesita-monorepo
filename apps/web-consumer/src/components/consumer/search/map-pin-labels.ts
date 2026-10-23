/** Pin names appear from this zoom (gate d4a). */
export const MAP_PIN_NAME_MIN_ZOOM = 14;

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
  const charW = 6.5;
  const padding = 8;
  const height = 18;
  const maxWidth = 168;
  const width = Math.min(maxWidth, Math.max(24, title.length * charW + padding * 2));
  const top = y + 14;
  const left = x - width / 2;
  return { left, top, right: left + width, bottom: top + height };
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
    const rect = estimateLabelRect(c.x, c.y, c.title);
    const blocked = placed.some((p) => intersects(rect, p));
    if (!blocked || c.focused) {
      visible.add(c.id);
      placed.push(rect);
    }
  }
  return visible;
}
