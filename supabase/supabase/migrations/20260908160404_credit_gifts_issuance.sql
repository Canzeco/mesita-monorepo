-- No-op: applied by mistake (a placeholder query sent instead of the real
-- one) while authoring MESITA-1677. Left in the ledger rather than
-- rewritten, matching the house rule that a stamped MCP timestamp is not
-- hand-edited — the real schema is 20260908160648_credit_gifts_issuance_schema.sql,
-- applied immediately after under its own name.
select 1;
