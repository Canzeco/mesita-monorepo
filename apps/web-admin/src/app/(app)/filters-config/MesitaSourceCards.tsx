import { Compass, Layers, MapPin, PartyPopper, Sparkles, Type } from "lucide-react";
import { ConfigSoon } from "@/components/admin-ui/ConfigSoon";
import { KnobStatus, SectionCard } from "@/components/admin-ui/config";

// The six Mesita sources, in taxonomy order: the four over Places, then the
// two over Social.
//
// ONE RANKER, FOUR DOORS. All four Places sources hand their candidates to
// the same Lineup blend under the calling mode's signal mask — what tells
// them apart is what DRAWS the candidate set, never what orders it. A string
// draws Name, a centre and a radius draw Nearby, nothing at all draws Browse,
// and an arbitrary set of predicates draws Flexible.
//
// TWO ARE LIVE WITHOUT KNOBS. Name Search is the Mesita lane inside Word's
// Deep pass (and all of Pay's `mesita` mode); Nearby Search is the listed
// lane behind every Map fetch. Neither has an operator number of its own —
// their counts live on the Word and Map mode boxes — so they carry Enforced,
// not Soon. Browse, Flexible and both Social sources have no engine at all.

export function MesitaSourceCards() {
  return (
    <div className="flex flex-col gap-4">
      <div id="s-mesita-name" className="scroll-mt-16">
        <SectionCard
          icon={<Type className="text-primary h-4 w-4" />}
          title="Mesita Places Name Search"
          subtitle="Cosine match on `places.name_embedding` — the Mesita name, never `google_name` and never the summary. Admits on a raw-cosine floor, then Lineup orders on the Name signal alone."
          status={
            <KnobStatus kind="enforced" reason="suggest-places · Word (Deep) · Pay" />
          }
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Word. Counts live on the Word (Deep Search) box; Pay runs
            this lane on its own with a floor of 10.
          </p>
        </SectionCard>
      </div>
      <div id="s-mesita-nearby" className="scroll-mt-16">
        <SectionCard
          icon={<MapPin className="text-primary h-4 w-4" />}
          title="Mesita Places Nearby Search"
          subtitle="Closest N listed Mesita Places around the camera centre. Always runs; the Google lane beside it is the opt-in one."
          status={<KnobStatus kind="enforced" reason="list-places · Map" />}
        >
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Used by Map. N is the guest&apos;s How many, never a console
            number. Listed pins then Lineup under the Map mask; the Google set
            stays distance.
          </p>
        </SectionCard>
      </div>
      <div id="s-mesita-browse" className="scroll-mt-16">
        <ConfigSoon
          Icon={Layers}
          title="Mesita Places Browse Search is coming soon"
          body="No query at all — the catalog itself, railed by occupied Atlas categories and a sampled vibe bank. Catalog calls it. Browse is the one source a guest reaches without typing or moving the map."
          doc="Notion Docs › Discovery"
        />
      </div>
      <div id="s-mesita-flexible" className="scroll-mt-16">
        <ConfigSoon
          Icon={Compass}
          title="Mesita Places Flexible Search is coming soon"
          body="An arbitrary set of predicates in, ordered places out. Swipe hands it the guest's four filters; Chat hands it whatever the question turned into. It is the general form the other three are special cases of."
          doc="Notion Docs › Discovery"
        />
      </div>
      <div id="s-social-browse" className="scroll-mt-16">
        <ConfigSoon
          Icon={PartyPopper}
          title="Mesita Social Browse Search is coming soon"
          body="Events a place hosts, not places. Catalog rails them. Social lost its own mode, not its retrieval — there is still no events engine behind either Social source."
          doc="Notion Docs › Discovery"
        />
      </div>
      <div id="s-social-flexible" className="scroll-mt-16">
        <ConfigSoon
          Icon={Sparkles}
          title="Mesita Social Flexible Search is coming soon"
          body="The same events under an arbitrary set of predicates, for when Chat is asked what is on tonight. Never merged into one list with places: an event and a venue are different answers."
          doc="Notion Docs › Discovery"
        />
      </div>
    </div>
  );
}
