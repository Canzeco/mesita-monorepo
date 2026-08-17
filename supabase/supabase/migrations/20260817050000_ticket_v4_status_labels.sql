-- THE TICKET v4 (MESITA-1086) — file A of two: enum labels ONLY.
--
-- Postgres forbids USING an enum label in the same transaction that added
-- it, and `supabase db push` wraps each file in one transaction — so the
-- three v4 labels land alone here, and everything that NAMES them (index
-- predicate, comments) lands in file B. Labels cannot be dropped, so the
-- legacy trio (pending_payment, paid, awaiting_story) stays in the type,
-- tolerated on read and never written.
--
-- The v4 machine (plan §12): open → scanned → approved → paying → revealed,
-- with fix_requested as a COLUMN at scanned, never a status.

alter type public.ticket_status add value if not exists 'scanned';
alter type public.ticket_status add value if not exists 'approved';
alter type public.ticket_status add value if not exists 'paying';
