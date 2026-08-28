import { MapPin, Search, TextSearch } from "lucide-react";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

// The three Google Places modules. Category knobs live on the shared
// Google types strip — these cards name who calls them. No extra knobs
// that nothing reads.

export function GoogleModuleCards() {
  return (
    <div className="flex flex-col gap-4">
      <div id="s-autocomplete" className="scroll-mt-16">
        <SectionCard
          icon={<Search className="text-primary h-4 w-4" />}
          title="Google Places Autocomplete"
          subtitle="Predicts a place name while the guest types. Name (Fast Search) is the only live caller."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Name (Fast Search). Types come from the Google types strip
            on this page.
          </p>
        </SectionCard>
      </div>
      <div id="s-nearby" className="scroll-mt-16">
        <SectionCard
          icon={<MapPin className="text-primary h-4 w-4" />}
          title="Google Places Nearby Search"
          subtitle="Fills the Google lane on Map. Closest-N, then overlaps drop against Mesita."
          status={<KnobStatus kind="enforced" reason="list-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Map. Types come from the Google types strip on this page.
          </p>
        </SectionCard>
      </div>
      <div id="s-text-search" className="scroll-mt-16">
        <SectionCard
          icon={<TextSearch className="text-primary h-4 w-4" />}
          title="Google Places Text Search"
          subtitle="Fills the Google lane on Name (Deep Search). Keeps vendor order after overlaps drop."
          status={<KnobStatus kind="enforced" reason="suggest-places · Search" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Name (Deep Search). Types come from the Google types strip
            on this page.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
