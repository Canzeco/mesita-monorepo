import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { AskAiPanel } from '@/components/memo/AskAiPanel';
import type { AddState } from '@/components/memo/types';
import { apiAskMemo, type MemoTurn } from '@/lib/api/memo';
import { apiCreateProject, type PlacePrediction } from '@/lib/api/place-search';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { supabase } from '@/lib/supabase';
import { errMsg } from '@/lib/utils';

type Coords = { lat: number; lng: number };

async function fetchCatalogPlaces(): Promise<Place[]> {
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    return result.deck;
  } catch {
    return apiFetchPublicPlaces(supabase);
  }
}

export function AskAiTab() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});

  const catalogQuery = useQuery({
    queryKey: ['memo-catalog-places'],
    queryFn: fetchCatalogPlaces,
  });
  const places = useMemo(
    () => catalogQuery.data ?? [],
    [catalogQuery.data],
  );

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const askMemo = useCallback(
    (text: string, history: MemoTurn[]) =>
      apiAskMemo(supabase, { query: text, location: coords, history }),
    [coords],
  );

  const resolvePlace = useCallback(
    (prediction: PlacePrediction) => matchPredictionToPlace(prediction, places),
    [places],
  );

  const handleInfo = useCallback((prediction: PlacePrediction) => {
    // Place detail route lands in MESITA-435 — surface identity until then.
    const id = prediction.mesitaSlug ?? prediction.mesitaId ?? prediction.mainText;
    Alert.alert(
      prediction.mainText,
      `Place detail is coming soon (${id}).`,
    );
  }, []);

  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      setAddStates((s) => ({ ...s, [prediction.placeId]: 'adding' }));
      void (async () => {
        try {
          await apiCreateProject(supabase, { placeId: prediction.placeId });
          setAddStates((s) => ({ ...s, [prediction.placeId]: 'added' }));
          Alert.alert(
            'Added to Mesita',
            `${prediction.mainText} is on Mesita — our AI generates its profile in about 5 minutes.`,
          );
        } catch (err) {
          setAddStates((s) => {
            const next = { ...s };
            delete next[prediction.placeId];
            return next;
          });
          Alert.alert(
            "Couldn't add",
            errMsg(err, "Couldn't add that place right now."),
          );
        }
      })();
    },
    [addStates],
  );

  return (
    <AskAiPanel
      ask={askMemo}
      addStates={addStates}
      resolvePlace={resolvePlace}
      onInfo={handleInfo}
      onAdd={handleAdd}
    />
  );
}
