-- Reservation call tracking — the Reservationist records each outbound attempt on
-- the reservation row so (a) the post-call webhook can map an ElevenLabs
-- conversation back to its reservation, and (b) the retry scheduler knows how many
-- attempts were made. Additive; existing rows default to zero attempts and null
-- call fields, so no data migration is needed.
--
-- Written by supabase-edgefunc-reservation-call. The reservation STATUS is
-- unchanged here — pending→confirmed still flips on business confirmation / the
-- post-call webhook.

alter table public.reservations
  add column if not exists call_attempts        integer     not null default 0,
  add column if not exists last_conversation_id text,
  add column if not exists last_called_at       timestamptz,
  add column if not exists last_call_status     text;

comment on column public.reservations.call_attempts is
  'How many times the Reservationist has phoned the venue for this reservation.';
comment on column public.reservations.last_conversation_id is
  'ElevenLabs Convai conversation_id of the most recent call — the join key for the post-call webhook.';
comment on column public.reservations.last_called_at is
  'When the most recent outbound call attempt was placed.';
comment on column public.reservations.last_call_status is
  'Outcome of the most recent attempt: placed | no_number | failed:… | phone_unresolved:… (diagnostic).';
