// Multiple Places Intake — one box: Create, Enrich, Update, Create + Enrich.
//
// Create is NOT scheduled. Fire every Google Place ID in one batch — Google
// accepts that fan-out. Enrich IS scheduled: admin-web-enrich-place only
// seeds place_research; pg_cron claims one row at a time.
// Create + Enrich is create then enrich — not a third function.

export type IntakeAction = "create" | "enrich" | "update";
