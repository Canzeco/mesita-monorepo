// What a tap already knows about the place, so the sheet's header paints at once.
// A reload has no seed, and the sheet reads the place itself.

export type RewardPlaceHeader = { name: string; photo: string | null };

let seed: ({ id: string } & RewardPlaceHeader) | null = null;

export function seedRewardPlace(id: string, name: string, photo?: string | null): void {
  seed = { id, name, photo: photo ?? null };
}

export function seededRewardPlace(id: string): RewardPlaceHeader | null {
  return seed?.id === id ? { name: seed.name, photo: seed.photo } : null;
}
