-- MESITA-1664 — `mock_code` joins the verification_method enum.
--
-- Pato, 2026-09-08: businesses stop adding places and instead claim, verify
-- and own them, and "for the moment just use a mock code 123456, nothing
-- else -- don't send emails nor make phone calls, you just need to input
-- shit."
--
-- WHY A NEW VALUE AND NOT `manual_contact`. Reusing manual_contact would
-- write, into the same admin queue a human reads, that a person made contact
-- with the merchant when nobody did. The operator cannot tell a real
-- verification from a mock one, which is exactly the kind of quiet lie that
-- outlives the shortcut that caused it. A distinct value keeps the queue
-- honest and makes tearing the mock out later a one-token grep.
--
-- Additive: no existing row changes, and every reader already falls back to
-- title-casing an unknown method, so nothing breaks if a client ships late.

alter type public.verification_method add value if not exists 'mock_code';
