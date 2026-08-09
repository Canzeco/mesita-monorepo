-- service_role-only reader for the ElevenLabs API key stored in Vault.
--
-- Why: EF secrets ELEVENLABS_KEY / ELEVEN_KEY have been pasted as the ElevenLabs
-- *key id* (64-char hex) instead of the secret value (sk_…). The Billing Test
-- probe and Reservationist then get "API key ID used as API key". Agents on
-- Cursor cloud cannot write EF secrets (no Management API token); they CAN
-- write Vault via SQL. Product EFs prefer Deno.env sk_ values, then fall back
-- to this RPC.
--
-- The Vault row itself is NOT in this migration (never commit plaintext keys).
-- Create/rotate with:
--   select vault.create_secret('<sk_…>', 'elevenlabs_api_key', 'ElevenLabs ConvAI');
-- or vault.update_secret(id, …) once the name exists.

CREATE OR REPLACE FUNCTION public.service_elevenlabs_api_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'elevenlabs_api_key'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.service_elevenlabs_api_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_elevenlabs_api_key() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_elevenlabs_api_key() TO service_role;

COMMENT ON FUNCTION public.service_elevenlabs_api_key() IS
  'Returns vault secret elevenlabs_api_key (sk_…). service_role only — EF fallback when ELEVENLABS_KEY holds a key id.';
