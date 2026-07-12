import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const DEFAULT_INTERVAL_MS = 15_000;

/** Poll pay-notification EF data (RN AppState instead of document.visibility). */
export function usePayNotificationPoll(
  refresh: () => void | Promise<void>,
  enabled = true,
  intervalMs = DEFAULT_INTERVAL_MS,
) {
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      void refresh();
    };

    const id = setInterval(tick, intervalMs);

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') tick();
    };
    const sub = AppState.addEventListener('change', onChange);

    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refresh, enabled, intervalMs]);
}
