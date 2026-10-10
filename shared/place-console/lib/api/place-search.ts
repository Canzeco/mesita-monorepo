// Google autocomplete + mint for the Add place ceremony.
// Kept out of lib/api/places.ts so the shell never imports the overview
// shape (shell-contract.test.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type PredictionState =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  state: PredictionState;
};

export async function apiPlacesAutocomplete(
  client: SupabaseClient,
  input: string,
  sessionToken: string,
): Promise<PlacePrediction[]> {
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];
  const { predictions } = await invokeEF<{ predictions: PlacePrediction[] }>(
    client,
    "business-web-suggest-places",
    { input: trimmed, sessionToken },
    "Couldn't search places right now.",
  );
  return predictions;
}

export type CreatedPlace = {
  id: string;
  slug: string | null;
  name: string;
};

export async function apiCreatePlace(
  client: SupabaseClient,
  googlePlaceId: string,
): Promise<CreatedPlace> {
  const { place } = await invokeEF<{ place: CreatedPlace }>(
    client,
    "business-web-create-place",
    { googlePlaceId },
    "Couldn't create that place.",
  );
  return place;
}
