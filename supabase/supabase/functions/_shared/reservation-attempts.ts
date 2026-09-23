// _shared/reservation-attempts.ts
import { nullable, num, object, str, type Infer } from "./doc-schema.ts";

// Promoted verbatim from supabase-edgefunc-reservation-call/index.ts's local,
// unexported `type AttemptEntry` (was read back with a bare `as` cast at the
// EF's own priorAttempts hydration site). Mechanical promotion, not a
// redesign — do not add, rename, or retype a field here.
export const AttemptEntrySchema = object({
  n: num(),
  started_at: str(),
  conversation_id: nullable(str()),
  result: str(),
});
export type AttemptEntry = Infer<typeof AttemptEntrySchema>;
