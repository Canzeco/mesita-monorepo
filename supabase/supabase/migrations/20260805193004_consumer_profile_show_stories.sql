-- MESITA-913: Mesita-side story visibility, independent of Instagram posting
-- and of private-account name anonymization.
--
-- profile_public (MESITA-76) already gates display-name anonymity for other
-- guests. Stories are a separate knob: a private account defaults to hiding
-- Mesita story activity unless the guest opts back in.

alter table public.consumers
  add column if not exists profile_show_stories boolean not null default true;

comment on column public.consumers.profile_show_stories is
  'When false, the guest''s story activity is hidden from other Mesita guests. Independent of Instagram posting and of profile_public name anonymity (MESITA-913).';
