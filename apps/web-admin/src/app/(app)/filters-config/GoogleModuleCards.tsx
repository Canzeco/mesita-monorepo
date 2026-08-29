import { MapPin, Search, TextSearch } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

// The three Google Places modules, in taxonomy order: Autocomplete ·
// Text Search · Nearby Search. Category knobs live on the shared Google
// types strip — these cards name who calls them.

export function GoogleModuleCards() {
  return (
    <div className="flex flex-col gap-4">
      <div id="s-autocomplete" className="scroll-mt-16">
        <SectionCard
          icon={<Search className="text-primary h-4 w-4" />}
          title="Google Places Autocomplete"
          subtitle="Predicts a place name while the guest types. Fast Search is Autocomplete only. Deep Search also calls it, then resolves and merges."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Name (Fast Search) and Name (Deep Search). Types come from
            the Google types strip on this page.
          </p>
        </SectionCard>
      </div>
      <div id="s-text-search" className="scroll-mt-16">
        <SectionCard
          icon={<TextSearch className="text-primary h-4 w-4" />}
          title="Google Places Text Search"
          subtitle="One Deep Search module. Candidates resolve, then merge with Autocomplete and Places Lineup Name."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Name (Deep Search). Types come from the Google types strip
            on this page. Merge is after resolve, not a fourth module.
          </p>
        </SectionCard>
      </div>
      <div id="s-nearby" className="scroll-mt-16">
        <SectionCard
          icon={<MapPin className="text-primary h-4 w-4" />}
          title="Google Places Nearby Search"
          subtitle="The billed Nearby Search. Map calls it. Name (Deep) does not."
          status={<KnobStatus kind="enforced" reason="list-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Map. Name (Deep) stays red on the matrix. Types come from
            the Google types strip on this page.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
