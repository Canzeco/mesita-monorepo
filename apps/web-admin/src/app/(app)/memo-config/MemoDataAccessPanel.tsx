import {
  Database,
  Lock,
  MapPinned,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { SectionCard } from "../enricher-config/atlas-ui";

// Memo Config · Data Access — the operator-facing map of Memo's data surface.
//
// Static documentation, deliberately: this page's job is to state the boundary,
// and a boundary you can edit from a console is not a boundary. The authority is
// supabase/config.toml + _shared/memo-data.ts; this mirrors it so an operator
// can see Memo's entire reach without reading the repo.
//
// KEEP IN SYNC: adding an endpoint to _shared/memo-data.ts means adding a row
// here in the same PR. A surface that under-reports itself is worse than none.

type Endpoint = {
  name: string;
  Icon: typeof Search;
  serves: string;
  withholds: string;
};

// The complete set. Order matches a turn's rough shape: config → persona →
// recall → lookup.
const ENDPOINTS: Endpoint[] = [
  {
    name: "supabase-edgefunc-get-memo-config",
    Icon: Settings2,
    serves:
      "Memo's own settings — the persona instructions and model from the Config tab, plus the memo_search sourcing policy. Read side only.",
    withholds:
      "No write path. Saving config stays on admin-web-update-memo-config, which only this console can call.",
  },
  {
    name: "supabase-edgefunc-get-consumer-context",
    Icon: UserRound,
    serves:
      "A persona clause for one signed-in consumer — “named Ana, 28 years old, female” — composed inside the function.",
    withholds:
      "The profile row itself. Full name, birthday and sex are read, reduced to that sentence, and dropped; age is derived, never the birthday. No Memo tool can call this — the user id comes from the authenticated caller, never from the model.",
  },
  {
    name: "supabase-edgefunc-recall-places",
    Icon: MapPinned,
    serves:
      "Memo's RAG leg: a candidate pool near the user, ranked by cosine relevance against the embedded intent, returned as public place cards. This is what seeds every place-seeking turn.",
    withholds:
      "Embedding vectors, ranker internals and OPENAI_KEY — all stay inside the function. It also never persists: it does not lazy-embed and write back, because Memo never writes.",
  },
  {
    name: "supabase-edgefunc-search-places",
    Icon: Search,
    serves:
      "Public catalog lookup — by name (the place_facts tool, and the legacy pipeline's on-Mesita sweep) and by Google place id (badging Google hits as on-Mesita).",
    withholds:
      "Everything outside the public card projection. Name search is scoped to browsable rows (status active or lead); the reply carries name, address, category, rating, listing type and ids — nothing else.",
  },
];

export function MemoDataAccessPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionCard
        icon={<ShieldCheck className="text-secondary h-4 w-4" />}
        title="The boundary"
        subtitle="Why Memo has no database client, and what that buys."
      >
        <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
          <p>
            Mesita&apos;s load-bearing rule is that clients call Edge Functions,
            never the database. Memo is held to the same rule even though it runs
            inside Supabase and could hold a service-role client outright.
          </p>
          <p>
            The reason is reach. A service-role client is a general query
            capability — holding one means every future Memo tool is one call
            away from a table nobody audited. Routing through four named
            endpoints makes Memo&apos;s data surface a <strong>closed set you
            can enumerate</strong>, which is this page. Each function owns its
            own query and projects the result to a public shape, so the column
            whitelist lives at the source rather than in the agent that consumes
            it.
          </p>
          <p>
            This is the second half of the airlock. The model can only call a
            whitelisted tool; a tool can only call a whitelisted endpoint. There
            is no generic query capability anywhere inside for a prompt injection
            to reach for.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Database className="text-secondary h-4 w-4" />}
        title="Memo's data surface"
        subtitle="All four endpoints. All read-only. This is the complete list."
      >
        <div className="mt-4 grid gap-3">
          {ENDPOINTS.map(({ name, Icon, serves, withholds }) => (
            <div
              key={name}
              className="border-border bg-background rounded-xl border p-4"
            >
              <div className="flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <code className="text-sm font-semibold break-all">{name}</code>
              </div>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {serves}
              </p>
              <p className="text-muted-foreground mt-2 flex gap-2 text-sm leading-relaxed">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{withholds}</span>
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Lock className="text-secondary h-4 w-4" />}
        title="How the endpoints are reached"
        subtitle="Naming is the access-control contract, so the names above are load-bearing."
      >
        <div className="text-muted-foreground mt-4 space-y-3 text-sm leading-relaxed">
          <p>
            Every Edge Function is named{" "}
            <code className="text-foreground">actor-origin-verb-noun</code> and
            encodes exactly one authorized caller. The{" "}
            <code className="text-foreground">supabase-edgefunc-</code> prefix
            marks an internal endpoint: it accepts no browser and no end user,
            only another Edge Function presenting a service-role credential. The
            gateway verifies that credential before the function runs.
          </p>
          <p>
            Two functions call this surface on Memo&apos;s behalf —{" "}
            <code className="text-foreground">consumer-web-ask-memo</code> (the
            Ask&nbsp;AI tab) and{" "}
            <code className="text-foreground">admin-web-ask-memo</code> (the
            Playground). Each identifies itself on every read, so the Playground
            exercises the identical surface production runs on.
          </p>
          <p>
            Note what is absent: there is no write, reserve, edit or delete
            endpoint here. Memo is passive by construction rather than by policy
            — the capability does not exist to be jailbroken into. Granting Memo
            a new one is a deliberate act that adds a row to this page.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
