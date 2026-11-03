import { Card } from "@/components/shell/Page";

/** The one box on a page that is not on yet (MESITA-3171, Pato: "just
 *  mention Soon, explain nothing"). */
export function SoonCard() {
  return (
    <Card>
      <p className="text-muted-foreground font-semibold">Soon</p>
    </Card>
  );
}
