import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ConsumerClass } from '@/lib/api/auth';
import {
  DEMO_INSTAGRAM_FOLLOWERS,
  DEMO_INSTAGRAM_HANDLE,
} from '@/lib/instagram-demo';

// Client-only demo override (Me → Class preview / MockControls). Same key as
// web (`mesita:mock-class`) so mental model stays aligned.
//
// Segments v6: the override is the previewed CLASS KEY — each class implies
// its door (premium = subscription, influencer = instagram, aura =
// invitation). A single explicit value per preview means the IG emulation can
// never override an explicit Aura preview (unlike web's two-axis MockAccount,
// which guards that case by hand).

const MOCK_CLASS_KEY = 'mesita:mock-class';
export type MockClass = 'standard' | 'premium' | 'influencer' | 'aura';
const MOCK_CLASS_VALUES: MockClass[] = [
  'standard',
  'premium',
  'influencer',
  'aura',
];

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

type ConsumerClassState = {
  key: 'standard' | 'premium' | 'influencer' | 'aura';
  origin: 'default' | 'instagram' | 'subscription' | 'invitation';
  followers: number;
  handle: string | null;
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
};

function normalize(
  c: ConsumerClass | null | undefined,
  profileHandle: string | null,
): ConsumerClassState {
  if (!c) return { ...STANDARD, handle: profileHandle };
  const raw = c.key ?? c.class ?? 'standard';
  return {
    key: (KNOWN_CLASS_KEYS as readonly string[]).includes(raw)
      ? (raw as ConsumerClassState['key'])
      : 'standard',
    origin: (c.origin as ConsumerClassState['origin']) ?? 'default',
    followers: c.followers ?? 0,
    handle: profileHandle,
  };
}

function applyMock(
  mock: MockClass,
  base: ConsumerClassState,
): ConsumerClassState {
  switch (mock) {
    case 'standard':
      return { ...base, key: 'standard', origin: 'default' };
    case 'influencer':
      // Instagram reach (≥ 1,000 followers) is the door into Influencer.
      return {
        ...base,
        key: 'influencer',
        origin: 'instagram',
        followers:
          base.followers > 0 ? base.followers : DEMO_INSTAGRAM_FOLLOWERS,
        handle: base.handle ?? DEMO_INSTAGRAM_HANDLE,
      };
    case 'premium':
      return {
        ...base,
        key: 'premium',
        origin: 'subscription',
      };
    case 'aura':
      // The invite-only presence class — the manual-invitation door.
      return {
        ...base,
        key: 'aura',
        origin: 'invitation',
      };
  }
}

export function useMockClass(): [
  MockClass | null,
  (next: MockClass | null) => void,
] {
  const [value, setValue] = useState<MockClass | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(MOCK_CLASS_KEY).then((stored) => {
      if (cancelled) return;
      setValue(
        MOCK_CLASS_VALUES.includes(stored as MockClass)
          ? (stored as MockClass)
          : null,
      );
    });
    const onChange = () => {
      void AsyncStorage.getItem(MOCK_CLASS_KEY).then((stored) => {
        if (!cancelled) {
          setValue(
            MOCK_CLASS_VALUES.includes(stored as MockClass)
              ? (stored as MockClass)
              : null,
          );
        }
      });
    };
    listeners.add(onChange);
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, []);

  const set = useCallback((next: MockClass | null) => {
    setValue(next);
    void (async () => {
      try {
        if (next == null) await AsyncStorage.removeItem(MOCK_CLASS_KEY);
        else await AsyncStorage.setItem(MOCK_CLASS_KEY, next);
      } catch {
        // best-effort
      }
      notify();
    })();
  }, []);

  return [value, set];
}

export function useEffectiveClass(
  consumerClass: ConsumerClass | null,
  profileHandle: string | null,
): ConsumerClassState {
  const [mock] = useMockClass();
  return useMemo(() => {
    const base = normalize(consumerClass, profileHandle);
    if (mock) return applyMock(mock, base);
    return base;
  }, [consumerClass, profileHandle, mock]);
}
