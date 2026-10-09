import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export type PlaceApiKeyMeta = {
  id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type PlaceApiKeyMinted = {
  id: string;
  /** Plaintext — shown once at mint. Never re-fetched. */
  token: string;
  key_prefix: string;
  label: string;
  created_at: string;
};

export async function apiCreatePlaceApiKey(
  client: SupabaseClient,
  placeId: string,
  opts?: { label?: string; rotate?: boolean },
): Promise<PlaceApiKeyMinted> {
  const { key } = await invokeEF<{ key: PlaceApiKeyMinted }>(
    client,
    "business-web-create-place-api-key",
    {
      placeId,
      ...(opts?.label ? { label: opts.label } : {}),
      ...(opts?.rotate ? { rotate: true } : {}),
    },
    "Couldn't create an API key.",
  );
  return key;
}

export async function apiListPlaceApiKeys(
  client: SupabaseClient,
  placeId: string,
): Promise<PlaceApiKeyMeta[]> {
  const { keys } = await invokeEF<{ keys: PlaceApiKeyMeta[] }>(
    client,
    "business-web-list-place-api-keys",
    { placeId },
    "Couldn't load API keys.",
  );
  return keys;
}

export async function apiRevokePlaceApiKey(
  client: SupabaseClient,
  placeId: string,
  keyId: string,
): Promise<void> {
  await invokeEF(
    client,
    "business-web-revoke-place-api-key",
    { placeId, keyId },
    "Couldn't revoke the API key.",
  );
}
