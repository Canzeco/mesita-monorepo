-- MESITA-3777: a Google or email sign-in carries `phone: ""` from Auth, and
-- the Business account step stored it as is. A blank is no number: make it
-- null. `_shared/auth.ts` now hands every EF null instead of "", so no new
-- blank is written after this.
update public.consumers
   set phone = null
 where phone = '';
