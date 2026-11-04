-- MESITA-3226 — the place's 6-digit code (Pato, 2026-11-04: "there they only set
-- the fucking number"). The owner sets it in Business › Rewards, and it will
-- authenticate closing a visit at visit.mesita.ai. Only its hash is kept, bound to
-- the place. Nothing reads it yet. Additive: old code ignores the column.

alter table public.place_rewards add column place_code_hash text;

comment on column public.place_rewards.place_code_hash is
  'MESITA-3226: SHA-256 of the place code, bound to the place (hashPlaceCode). NULL = not set. Never sent to a client.';
