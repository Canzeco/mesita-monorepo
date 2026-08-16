import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AskAiPanel } from '@/components/memo/AskAiPanel';
import type { AddState } from '@/components/memo/types';
import { apiAskMemo, apiMemoGreeting, type MemoTurn } from '@/lib/api/memo';
import { apiCreateProject, type PlacePrediction } from '@/lib/api/place-search';
import {
  apiFetchPublicPlaces,
  apiRecommendDeck,
  type Place,
} from '@/lib/api/places';
import { placePath } from '@/lib/consumer-route-contract';
import { matchPredictionToPlace } from '@/lib/match-prediction';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { errMsg } from '@/lib/utils';

type Coords = { lat: number; lng: number };

// Local catalog Memo resolves its place mentions against. The deck EF is just
// a cheap random sample of active places — Memo does its own retrieval
// server-side; this list is only for matching names back to rows.
async function fetchCatalogPlaces(): Promise<Place[]> {
  try {
    const result = await apiRecommendDeck(supabase, { limit: 50 });
    return result.deck;
  } catch {
    return apiFetchPublicPlaces(supabase);
  }
}

export function AskAiTab() {
  const router = useRouter();
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

  const loadGreeting = useCallback(() => apiMemoGreeting(supabase), []);

  const resolvePlace = useCallback(
    (prediction: PlacePrediction) => matchPredictionToPlace(prediction, places),
    [places],
  );

  const handleInfo = useCallback(
    (prediction: PlacePrediction) => {
      // Prefer the EF-provided Mesita identity; fall back to a catalog match.
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(placePath(direct));
        return;
      }
      const match = matchPredictionToPlace(prediction, places);
      if (match) {
        router.push(placePath(match.slug || match.id));
        return;
      }
      toast(
        "This place is on Mesita but isn't in the catalog snapshot yet — opening it from here is coming soon.",
      );
    },
    [places, router],
  );

  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      setAddStates((s) => ({ ...s, [prediction.placeId]: 'adding' }));
      void (async () => {
        try {
          await apiCreateProject(supabase, { placeId: prediction.placeId });
          setAddStates((s) => ({ ...s, [prediction.placeId]: 'added' }));
          toast.success(
            `${prediction.mainText} is on Mesita — our AI generates its profile in about 5 minutes.`,
          );
        } catch (err) {
          setAddStates((s) => {
            const next = { ...s };
            delete next[prediction.placeId];
            return next;
          });
          toast.error(errMsg(err, "Couldn't add that place right now."));
        }
      })();
    },
    [addStates],
  );

  return (
    <AskAiPanel
      ask={askMemo}
      loadGreeting={loadGreeting}
      addStates={addStates}
      resolvePlace={resolvePlace}
      onInfo={handleInfo}
      onAdd={handleAdd}
    />
  );
}
