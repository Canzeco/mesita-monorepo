"use client";

// Ask AI — the Memo concierge as a full Home tab (moved off Search, MESITA-156
// follow-up). Provides the same deps SearchClient used to give AskAiPanel — the
// Supabase client, live location for "near me", and the navigate / create-place
// handlers — around the shared, inline-layout AskAiPanel.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";
import type { Place } from "@/lib/api/places";
import { apiCreateProject, type PlacePrediction } from "@/lib/api/place-search";
import { apiAskMemo, type MemoTurn } from "@/lib/api/memo";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { AskAiPanel } from "@/components/consumer/search/AskAiPanel";
import { matchPredictionToPlace } from "@/components/consumer/search/search-utils";
import type { AddState } from "@/components/consumer/search/PredictionRow";

export function AskAiTab({ places }: { places: Place[] }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});

  const askMemo = useCallback(
    (text: string, history: MemoTurn[]) =>
      apiAskMemo(supabase, { query: text, location: userLocation, history }),
    [supabase, userLocation],
  );

  const resolvePlace = useCallback(
    (prediction: PlacePrediction) => matchPredictionToPlace(prediction, places),
    [places],
  );

  const handleInfo = useCallback(
    (prediction: PlacePrediction) => {
      // Prefer the EF-provided Mesita identity; fall back to a catalog match.
      const direct = prediction.mesitaSlug ?? prediction.mesitaId;
      if (direct) {
        router.push(placeHref(direct));
        return;
      }
      const match = matchPredictionToPlace(prediction, places);
      if (match) {
        router.push(placeHref(match.slug || match.id));
        return;
      }
      toast(
        "This place is on Mesita but isn't in the catalog snapshot yet — opening it from here is coming soon.",
      );
    },
    [places, router],
  );

  // The REAL Add flow: create the place immediately; only enrichment is
  // scheduled (the cron Enricher finishes async), so hold the row in its
  // added / Enriching state.
  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      setAddStates((s) => ({ ...s, [prediction.placeId]: "adding" }));
      void (async () => {
        try {
          await apiCreateProject(supabase, { placeId: prediction.placeId });
          setAddStates((s) => ({ ...s, [prediction.placeId]: "added" }));
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
    [addStates, supabase],
  );

  return (
    <AskAiPanel
      layout="inline"
      ask={askMemo}
      addStates={addStates}
      resolvePlace={resolvePlace}
      onInfo={handleInfo}
      onAdd={handleAdd}
    />
  );
}
