"use client";

// Ask AI — the Memo concierge as a full Home tab (moved off Search, MESITA-156
// follow-up). Provides the same deps SearchClient used to give AskAiPanel — the
// Supabase client, live location for "near me", and the navigate / create-place
// handlers — around the shared, inline-layout AskAiPanel.

import { useCallback, useState } from "react";
import { Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { useUserLocation } from "@/lib/use-user-location";
import type { Place } from "@/lib/api/places";
import { apiCreateProject, type PlacePrediction } from "@/lib/api/place-search";
import { apiAskMemo, apiMemoGreeting, type MemoTurn } from "@/lib/api/memo";
import { placeHref } from "@/lib/place-route";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";
import { AskAiPanel } from "@/components/consumer/search/AskAiPanel";
import { MemoModeHeader } from "@/components/consumer/home/MemoModeHeader";
import { ComingSoonModal } from "@/components/consumer/ComingSoonModal";
import { matchPredictionToPlace } from "@/components/consumer/search/search-utils";
import type { AddState } from "@/components/consumer/search/add-state";

export function AskAiTab({ places }: { places: Place[] }) {
  const router = useRouter();
  const [callSoon, setCallSoon] = useState(false);
  const supabase = useBrowserSupabase();
  const userLocation = useUserLocation();
  const [addStates, setAddStates] = useState<Record<string, AddState>>({});

  const askMemo = useCallback(
    (text: string, history: MemoTurn[]) =>
      apiAskMemo(supabase, { query: text, location: userLocation, history }),
    [supabase, userLocation],
  );

  const loadGreeting = useCallback(
    () => apiMemoGreeting(supabase),
    [supabase],
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

  // Create only — the ugly profile is live immediately. Intaker waits
  // for votes on the Enrich tab.
  const handleAdd = useCallback(
    (prediction: PlacePrediction) => {
      if (addStates[prediction.placeId]) return;
      setAddStates((s) => ({ ...s, [prediction.placeId]: "adding" }));
      void (async () => {
        try {
          const created = await apiCreateProject(supabase, {
            placeId: prediction.placeId,
          });
          setAddStates((s) => ({ ...s, [prediction.placeId]: "added" }));
          toast.success(
            `${prediction.mainText} is on Mesita. Vote to enrich its profile.`,
          );
          const dest = created.place.slug || created.place.id;
          if (dest) router.push(placeHref(dest));
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
    [addStates, router, supabase],
  );

  // Header (shrink-0) + panel (min-h-0 flex-1): the thread scrolls under a
  // pinned header rather than pushing it off, the same two-part shape the
  // place-detail shells use.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <MemoModeHeader />
      <div className="min-h-0 flex-1">
        <AskAiPanel
          layout="inline"
          ask={askMemo}
          loadGreeting={loadGreeting}
          addStates={addStates}
          resolvePlace={resolvePlace}
          onInfo={handleInfo}
          onAdd={handleAdd}
          onCall={() => setCallSoon(true)}
        />
      </div>

      {/* CALL IS ANNOUNCED, NOT WIRED (Pato, live: "announced only, for now").
          There is no Memo voice agent and no number behind it — the ElevenLabs
          workspace holds none — so the button opens this panel instead of
          dialling. It stays visible because the two-way shape IS the product
          statement, and it is styled as a muted sibling of Send rather than a
          second CTA (MESITA-601 — no "soon" badges anywhere in this app). */}
      <ComingSoonModal
        open={callSoon}
        onClose={() => setCallSoon(false)}
        title="Calling Don Memo"
        body="Soon you'll be able to call Don Memo and just say what you're in the mood for — he'll talk you to a table. Until then he's right here, in chat."
        icon={Phone}
      />
    </div>
  );
}
