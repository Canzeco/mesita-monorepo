-- MESITA-2131: the ticket-proofs bucket goes too.
--
-- It held visit-story screenshots for Second Stage tickets. MESITA-2091 dropped
-- its two policies but had to leave the bucket, because storage refuses a
-- plain DELETE on its tables. It is empty on live and nothing writes to it.
--
-- storage.protect_delete lets a delete through only when
-- storage.allow_delete_query is 'true' for the transaction, so the setting and
-- the delete share one DO block. If the bucket ever holds a file again this
-- refuses instead of leaving the file orphaned.

do $drop_ticket_proofs$
begin
  if exists (select 1 from storage.objects where bucket_id = 'ticket-proofs') then
    raise exception 'ticket-proofs still holds objects; empty it through the Storage API first';
  end if;

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'ticket-proofs';
end $drop_ticket_proofs$;
