import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const TUTORIAL_KEY = 'mesita_swipe_tutorial_seen';
const TUTORIAL_AUTO_DISMISS_MS = 5500;

export function useSwipeTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const seen = await AsyncStorage.getItem(TUTORIAL_KEY);
      if (cancelled || seen) return;
      setShowTutorial(true);
      timer = setTimeout(() => {
        setShowTutorial(false);
        void AsyncStorage.setItem(TUTORIAL_KEY, '1');
      }, TUTORIAL_AUTO_DISMISS_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismissTutorial = useCallback(() => {
    setShowTutorial((was) => {
      if (was) void AsyncStorage.setItem(TUTORIAL_KEY, '1');
      return false;
    });
  }, []);

  return { showTutorial, dismissTutorial };
}
