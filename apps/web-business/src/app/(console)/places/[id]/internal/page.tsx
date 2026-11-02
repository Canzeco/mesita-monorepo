import { notFound } from "next/navigation";
import { getManagePlace } from "@/lib/place-view";
import { listVerifications } from "@/lib/business-api";
import { Card } from "@/components/shell/Page";
import { VerificationQueue } from "@/components/internal/VerificationQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Internal" };

// Mesita staff only (MESITA-3103). The data is staff-only at the source:
// business-web-get-place adds these fields only for a super-admin, and
// business-web-list-verifications refuses anyone else. This page also 404s
// for an owner so the view is never drawn empty.

function fmt(iso: unknown): string {
  if (typeof iso !== "string") return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function vectorDims(raw: unknown): number | null {
  if (Array.isArray(raw)) return raw.length;
  if (typeof raw === "string" && raw.startsWith("[")) return raw.split(",").length;
  return null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  );
}

export default async function InternalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage || manage.role !== "superadmin") notFound();
  const p = manage.place as Record<string, unknown>;
  const queue = await listVerifications(id);
  const yes = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : "—");
  const summary = typeof p.embedding_source_text === "string" ? p.embedding_source_text.trim() : "";
  const dims = vectorDims(p.embedding);

  return (
    <div className="grid gap-4 pb-8 lg:grid-cols-2">
      <Card>
        <p className="mb-3 font-semibold">State</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Row label="State" value={String(p.state ?? "—")} />
          <Row label="Listed" value={yes(p.listed)} />
          <Row label="Seeded" value={yes(p.seeded)} />
          <Row label="Enriched" value={yes(p.enriched)} />
          <Row label="Content" value={String(p.content_state ?? "—")} />
          <Row
            label="Enrich ladder"
            value={typeof p.enrich_crenup === "number" ? `${p.enrich_crenup} of ${String(p.enrich_crenup_total ?? 8)}` : "—"}
          />
          <Row label="Premier level" value={String(p.boost_tier ?? 0)} />
          <Row label="Requests" value={`${String(p.request_count ?? 0)} of ${String(p.request_threshold ?? "—")}`} />
        </dl>
      </Card>
      <Card>
        <p className="mb-3 font-semibold">Embeddings</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Row label="Vector" value={dims ? `text-embedding-3-small · ${dims}d` : "None yet"} />
          <Row label="Summary" value={summary || "None yet"} />
        </dl>
      </Card>
      <Card>
        <p className="mb-3 font-semibold">Record</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Row label="UID" value={<code className="text-xs">{String(p.id)}</code>} />
          <Row label="Google id" value={<code className="text-xs">{String(p.google_place_id ?? "—")}</code>} />
          <Row label="Created" value={fmt(p.created_at)} />
          <Row label="Updated" value={fmt(p.updated_at)} />
          <Row label="Enriched at" value={fmt(p.enriched_at)} />
        </dl>
      </Card>
      <Card className="lg:col-span-2">
        <p className="mb-3 font-semibold">Who runs this place</p>
        {queue.ok ? (
          <VerificationQueue owners={queue.data.owners} pending={queue.data.pending} showPlace={false} />
        ) : (
          <p className="text-destructive text-sm">{queue.error}</p>
        )}
      </Card>
    </div>
  );
}
