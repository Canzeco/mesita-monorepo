import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// Device-level prefs (Me → Settings). Web uses localStorage; mobile uses
// AsyncStorage. Same key names so values stay conceptually aligned.

const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string, onChange: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  const subscribers = set;
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0) listeners.delete(key);
  };
}

function notifyKey(key: string): void {
  listeners.get(key)?.forEach((l) => l());
}

async function readString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeString(key: string, value: string | null): Promise<void> {
  try {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // best-effort persistence
  }
  notifyKey(key);
}

export function useStoredFlag(
  key: string,
  defaultOn: boolean,
): [boolean, (next?: boolean) => void] {
  const [on, setOn] = useState(defaultOn);

  useEffect(() => {
    let cancelled = false;
    void readString(key).then((stored) => {
      if (cancelled) return;
      setOn(stored == null ? defaultOn : stored === '1');
    });
    return subscribeKey(key, () => {
      void readString(key).then((stored) => {
        if (!cancelled) setOn(stored == null ? defaultOn : stored === '1');
      });
    });
  }, [key, defaultOn]);

  const set = useCallback(
    (next?: boolean) => {
      setOn((current) => {
        const value = next ?? !current;
        void writeString(key, value ? '1' : '0');
        return value;
      });
    },
    [key],
  );

  return [on, set];
}

export function useStoredString(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    let cancelled = false;
    void readString(key).then((stored) => {
      if (!cancelled) setValue(stored ?? defaultValue);
    });
    return subscribeKey(key, () => {
      void readString(key).then((stored) => {
        if (!cancelled) setValue(stored ?? defaultValue);
      });
    });
  }, [key, defaultValue]);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      void writeString(key, next);
    },
    [key],
  );

  return [value, set];
}

export const PREF_KEYS = {
  push: 'mesita:notif:push',
  location: 'mesita:perm:location',
  contacts: 'mesita:perm:contacts',
  language: 'mesita:pref:language',
  defaultCity: 'mesita:pref:default-city',
} as const;
