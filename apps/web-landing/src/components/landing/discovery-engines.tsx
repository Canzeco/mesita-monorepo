import {
  Globe,
  Heart,
  LayoutGrid,
  Map,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SectionHeader } from "@/components/landing/section-header";

const ENGINES: { name: string; note: string; Icon: LucideIcon }[] = [
  { name: "Name", note: "type it, find it", Icon: Search },
  { name: "Map", note: "the whole city, live", Icon: Map },
  { name: "Swipe", note: "tonight’s deck", Icon: Sparkles },
  { name: "Catalog", note: "browse everything", Icon: LayoutGrid },
  { name: "Chat", note: "ask the concierge", Icon: MessageCircle },
  { name: "Social", note: "where your people are", Icon: Users },
  { name: "Favorites", note: "the places you keep", Icon: Heart },
  { name: "Web", note: "AI search, open internet", Icon: Globe },
];

function DiscoveryEngines() {
  return (
    <section id="discovery" className="border-border bg-muted/30 border-b">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 md:py-24">
        <SectionHeader
          eyebrow="Discovery"
          title="Eight ways to ask “where are we going?”"
          aside="Different doors, one intelligence underneath."
        />
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
          {ENGINES.map(({ name, note, Icon }) => (
            <div
              key={name}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border px-4 py-3.5"
            >
              <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-tight font-semibold">
                  {name}
                </span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {note}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export { DiscoveryEngines };
