import { getPlaceInsights } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

// Insights (MESITA-3206, Pato: "how many times someone viewed and liked your
// profile and if they shared the profile"): one card of three numbers. Each
// counts signed-in guests, not taps, and every number is the server's.
export default async function InsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insights = await getPlaceInsights(id);
  if (!insights.ok) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <Card>
          <p className="font-semibold">Insights didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{insights.error}</p>
        </Card>
      </div>
    );
  }
  const rows = [
    { name: "Views", line: "Guests who opened your place.", value: insights.data.views },
    { name: "Likes", line: "Guests who saved it to their favorites.", value: insights.data.likes },
    { name: "Shares", line: "Guests who shared it or copied its link.", value: insights.data.shares },
  ];
  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card className="flex flex-col p-0 sm:p-0">
        <ul className="divide-border divide-y">
          {rows.map((row) => (
            <li key={row.name} className="flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.name}</p>
                <p className="text-muted-foreground">{row.line}</p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{row.value.toLocaleString("en-US")}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
