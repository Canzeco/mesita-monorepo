type HistoryItem = { placeId: string; kind: string; at: string; placeName: string; photo: string | null };

/** One tile per place for the tab, newest first. */
export function historyTiles(items: HistoryItem[], tab: "viewed" | "saved"): HistoryItem[] {
  const seen = new Set<string>();
  const tiles: HistoryItem[] = [];
  for (const item of items) {
    if (item.kind !== tab || seen.has(item.placeId)) continue;
    seen.add(item.placeId);
    tiles.push(item);
  }
  return tiles;
}
