// Consumer "Add to Mesita" create flow — port of web place-search.ts subset.

import type { SupabaseClient } from '@supabase/supabase-js';

import { invokeEF } from '@/lib/ef';

export {
  apiSuggestPlaces,
  type PlacePrediction,
} from '@/lib/api/places';

type CreatedProject = {
  ok: boolean;
  place: { id: string; slug: string; name: string; status: string };
};

export async function apiCreateProject(
  client: SupabaseClient,
  input: { placeId: string },
): Promise<CreatedProject> {
  return invokeEF<CreatedProject>(
    client,
    'consumer-web-create-place',
    { googlePlaceId: input.placeId },
    "Couldn't add that place right now.",
  );
}
