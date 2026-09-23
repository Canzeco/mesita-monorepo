import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ConsumerClass } from '@/lib/api/auth';
import {
  INSTAGRAM_REACH_FOLLOWERS,
  type ConsumerFacts,
} from '@/lib/consumer-identity';
import {
  DEMO_INSTAGRAM_FOLLOWERS,
  DEMO_INSTAGRAM_HANDLE,
} from '@/lib/instagram-demo';

// Client-only demo override (MockControls, the Diamond page). Same shape as
// web's `mesita:mock-account` blob so the mental model stays aligned.
//
// IT WAS ONE CLASS KEY (MESITA-2040). The override used to be the previewed
// CLASS, and each class implied its door — premium meant a subscription,
// influencer meant Instagram, aura meant an invitation. One value per preview
// was the whole design: it meant the IG emulation could never outrank an
// explicit Aura preview, because there was one slot and only one thing could
// hold it.
//
// Two independent facts need two independent switches, and nothing competes
// for a slot any more: Diamond and Instagram can both be on, and the preview
// is simply both. `premium` is deliberately NOT here — a subscription grants
// no fact on this surface and Me › Plan owns that axis.
//
// A stored string from the old shape parses to "nothing overridden", except
// `'aura'`, the one value of the old enum that still names something true.

const MOCK_CLASS_KEY = 'mesita:mock-class';
export type MockFacts = { diamond: boolean; instagram: boolean };
const MOCK_OFF: MockFacts = { diamond: false, instagram: false };

function parseMock(raw: string | null): MockFacts | null {
  if (!raw) return null;
  // The legacy single-key shape. `aura` was the invitation class.
  if (!raw.startsWith('{')) {
    return raw === 'aura'
      ? { diamond: true, instagram: false }
      : raw === 'influencer'
        ? { diamond: false, instagram: true }
        : null;
  }
  try {
    const v = JSON.parse(raw) as Partial<MockFacts>;
    const next = {
      diamond: v.diamond === true,
      instagram: v.instagram === true,
    };
    return next.diamond || next.instagram ? next : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Open doors, independent of which one wins the class slot (MESITA-972).
 *  Standard is always open, so only the three earned/paid doors are carried.
 *  The class rail renders unlocked-vs-locked off this. */
export type ClassDoors = {
  influencer: boolean;
  premium: boolean;
  aura: boolean;
};

type ConsumerClassState = {
  key: 'standard' | 'premium' | 'influencer' | 'aura';
  origin: 'default' | 'instagram' | 'subscription' | 'invitation';
  followers: number;
  handle: string | null;
  doors: ClassDoors;
};

// The known class keys — an unknown/stale server key (e.g. the retired
// "magnetic") normalizes to Standard instead of leaking into gates.
const KNOWN_CLASS_KEYS = [
  'standard',
  'premium',
  'influencer',
  'aura',
] as const;

const STANDARD: ConsumerClassState = {
  key: 'standard',
  origin: 'default',
  followers: 0,
  handle: null,
  doors: { influencer: false, premium: false, aura: false },
};

function normalize(
  c: ConsumerClass | null | undefined,
  profileHandle: string | null,
): ConsumerClassState {
  if (!c) return { ...STANDARD, handle: profileHandle };
  const raw = c.key ?? c.class ?? 'standard';
  const key = (KNOWN_CLASS_KEYS as readonly string[]).includes(raw)
    ? (raw as ConsumerClassState['key'])
    : 'standard';
  const followers = c.followers ?? 0;
  return {
    key,
    origin: (c.origin as ConsumerClassState['origin']) ?? 'default',
    followers,
    handle: profileHandle,
    // Server-computed doors when the EF ships them; otherwise derive from
    // what the payload already proves (reach from followers, the paid door
    // from the live subscription, Aura only when it holds the slot).
    doors: c.doors ?? {
      influencer: followers >= INSTAGRAM_REACH_FOLLOWERS,
      premium: c.subscription != null,
      aura: key === 'aura',
    },
  };
}

function applyMock(
  mock: MockFacts,
  base: ConsumerClassState,
): ConsumerClassState {
  // `key` and `origin` are STORAGE, and the demo still has to seed them: the
  // ticket screen, the promo chip and place detail read the key because the
  // rewards engine really prices Base vs Diamond. Diamond maps to
  // `aura`; everything else previews as `standard`, which is what an account
  // with no invitation actually holds. Instagram lifts nothing.
  const key: ConsumerClassState['key'] = mock.diamond ? 'aura' : 'standard';
  const origin: ConsumerClassState['origin'] = mock.diamond
    ? 'invitation'
    : mock.instagram
      ? 'instagram'
      : 'default';
  return {
    ...base,
    key,
    origin,
    // Mock IG always uses the demo profile (@mock / 5k) — MESITA-935.
    followers: mock.instagram ? DEMO_INSTAGRAM_FOLLOWERS : base.followers,
    handle: mock.instagram ? DEMO_INSTAGRAM_HANDLE : base.handle,
    // Preview doors mirror ONLY the toggles, so each demo state is
    // deterministic regardless of the real account underneath.
    doors: {
      influencer: mock.instagram,
      premium: false,
      aura: mock.diamond,
    },
  };
}

/** THE GUEST-FACING READ (MESITA-2040). Everything a surface should SAY about
 *  an account comes from here; `useEffectiveClass` below is the storage view
 *  that the rewards surfaces still need.
 *
 *  DIAMOND IS THE CLASS KEY, NOT THE ORIGIN. The admin console's
 *  grant writes the key and leaves origin alone, so an `origin ===
 *  'invitation'` test would tell a hand-granted guest they are not on the
 *  list. The auth provider folds both the metal `diamond` and the legacy
 *  `aura` onto `aura` (`legacyKeyForStoredClass`), so `aura` is the one test.
 *  (The granting function is named in Docs › Passport §C, never here —
 *  `ef-caller-acl.test.ts` string-scans this package for admin-actor EFs.)
 *
 *  INSTAGRAM IS THE HANDLE PLUS THE BAR, separately: Story Bonus rides a
 *  connected handle (MESITA-909), the 1,000 bar makes an account verified. */
function factsFor(
  state: ConsumerClassState,
  unknown: boolean,
): ConsumerFacts {
  const connected = Boolean(state.handle) || state.origin === 'instagram';
  return {
    diamond: state.key === 'aura',
    igConnected: connected,
    igHandle: state.handle,
    igFollowers: state.followers,
    igReach: connected && state.followers >= INSTAGRAM_REACH_FOLLOWERS,
    unknown,
  };
}

export function useMockFacts(): [
  MockFacts | null,
  (patch: Partial<MockFacts> | null) => void,
] {
  const [value, setValue] = useState<MockFacts | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void AsyncStorage.getItem(MOCK_CLASS_KEY).then((stored) => {
        if (!cancelled) setValue(parseMock(stored));
      });
    };
    load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, []);

  const set = useCallback((patch: Partial<MockFacts> | null) => {
    setValue((current) => {
      const next =
        patch == null ? null : { ...(current ?? MOCK_OFF), ...patch };
      const settled = next && (next.diamond || next.instagram) ? next : null;
      void (async () => {
        try {
          if (settled == null) await AsyncStorage.removeItem(MOCK_CLASS_KEY);
          else
            await AsyncStorage.setItem(MOCK_CLASS_KEY, JSON.stringify(settled));
        } catch {
          // best-effort
        }
        notify();
      })();
      return settled;
    });
  }, []);

  return [value, set];
}

/** The storage view. Still read by the rewards surfaces (the ticket screen,
 *  the promo chip, AI Connect's gate) because the engine really does apply a
 *  rung. NOTHING ON THE IDENTITY SURFACE may call it. */
export function useEffectiveClass(
  consumerClass: ConsumerClass | null,
  profileHandle: string | null,
): ConsumerClassState {
  const [mock] = useMockFacts();
  return useMemo(() => {
    const base = normalize(consumerClass, profileHandle);
    if (mock) return applyMock(mock, base);
    return base;
  }, [consumerClass, profileHandle, mock]);
}

/** The guest view — what Me and the two doors render. */
export function useEffectiveFacts(
  consumerClass: ConsumerClass | null,
  profileHandle: string | null,
  unknown = false,
): ConsumerFacts {
  const [mock] = useMockFacts();
  const state = useEffectiveClass(consumerClass, profileHandle);
  // A previewed account is a KNOWN account — the toggles state it outright.
  return useMemo(() => factsFor(state, mock ? false : unknown), [state, mock, unknown]);
}
