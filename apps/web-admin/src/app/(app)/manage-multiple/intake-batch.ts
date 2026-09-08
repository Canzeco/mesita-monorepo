// Places Intake — one box: Create, Delete, List, Unlist, Enrich.
//
// Create is NOT scheduled. Fire every Google Place ID in one batch — Google
// accepts that fan-out. Enrich IS scheduled: admin-web-enrich-place only
// seeds place_research; pg_cron claims one row at a time. List, Unlist and
// Delete are single fire-and-check writes, same shape as Create's per-ID
// fan-out.
//
// Active, Verified and Partnered are NOT actions here (MESITA-1664, decision:
// Pato — "place cannot be partner from the console"): a manager claims,
// verifies and owns a place from the business console, then onboards Stripe
// to activate Partnership from there too.

export type IntakeAction = "create" | "delete" | "list" | "unlist" | "enrich";
