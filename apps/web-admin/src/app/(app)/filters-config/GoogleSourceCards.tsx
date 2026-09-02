import { MapPin, Search, TextSearch } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

// The three Google Places sources, in taxonomy order: Autocomplete Search ·
// Text Search · Nearby Search. Category knobs live on the shared Google
// types strip — these cards name who calls them.
//
// All three keep the word `Search` because Google named its own endpoints
// that way; every other Source drops the class noun.

export function GoogleSourceCards() {
  return (
    <div className="flex flex-col gap-4">
      <div id="s-autocomplete" className="scroll-mt-16">
        <SectionCard
          icon={<Search className="text-primary h-4 w-4" />}
          title="Google Places Autocomplete Search"
          subtitle="Predicts a place name while the guest types, and is the ONE source that answers with a Location. Word's Fast pass is Autocomplete only; its Deep pass also calls it, then resolves and merges."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Word. Types come from the Google types strip on this page.
          </p>
        </SectionCard>
      </div>
      <div id="s-text-search" className="scroll-mt-16">
        <SectionCard
          icon={<TextSearch className="text-primary h-4 w-4" />}
          title="Google Places Text Search"
          subtitle="One Word (Deep Search) source. Candidates resolve, then merge with Autocomplete and Mesita Places Name Search."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Word and Chat. Types come from the Google types strip on
            this page. Merge is after resolve, not a fourth source.
          </p>
        </SectionCard>
      </div>
      <div id="s-nearby" className="scroll-mt-16">
        <SectionCard
          icon={<MapPin className="text-primary h-4 w-4" />}
          title="Google Places Nearby Search"
          subtitle="The billed Nearby Search. Map calls it. Word does not."
          status={<KnobStatus kind="enforced" reason="list-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Map and Chat. Word stays red on the matrix — the guest pin
            biases Autocomplete and Text Search, and a bias is not a call.
            Types come from the Google types strip on this page.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
