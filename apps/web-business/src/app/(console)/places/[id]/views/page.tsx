import { getPlaceViews } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Views" };

// Views (MESITA-3206, Pato: "Views (like eyes), Visits (like walk-ins) ... online
// is the number of views, the number of likes, the number of shares"): one card
// of three numbers. Each counts signed-in guests, not taps, and every number is
// the server's.
export default async function ViewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const views = await getPlaceViews(id);
  if (!views.ok) {
    return (
      <div className="flex flex-col gap-4 pb-8">
        <Card>
          <p className="font-semibold">Views didn&apos;t load.</p>
          <p className="text-muted-foreground mt-1 text-sm">{views.error}</p>
        </Card>
      </div>
    );
  }
  const rows = [
    { name: "Views", line: "Guests who opened your place.", value: views.data.views },
    { name: "Likes", line: "Guests who saved it to their favorites.", value: views.data.likes },
    { name: "Shares", line: "Guests who shared it or copied its link.", value: views.data.shares },
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
