import { redirect } from "next/navigation";
import { TrendingUp, AlertTriangle, MessageCircle } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import {
  ANALYTICS_KPIS,
  FUNNEL,
  SECONDARY_METRICS,
  VERIFIED_STORIES,
  VALIDATOR_FEED,
  VALIDATOR_THREAD,
} from "@/lib/manager-data";
import { tierBadgeClass } from "@/lib/guest-data";
import { cn } from "@/lib/utils";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in?next=/manager/performance");

  const maxFunnel = FUNNEL[0].value;
  const selected = VALIDATOR_FEED[0];

  return (
    <>
      <Topbar
        title="Performance"
        subtitle="Marketing & financial performance powered by Mesita."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-6">
          <div className="border-secondary/40 bg-secondary/5 text-secondary rounded-2xl border border-dashed px-4 py-3 text-[12px]">
            Preview — these performance numbers are mock values. Real KPIs ship
            once the audit log + the manager-get-analytics Edge Function are in
            place.
          </div>
          {/* ---------- Top KPIs ---------- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ANALYTICS_KPIS.map((k) => (
              <Stat key={k.label} {...k} />
            ))}
          </div>

          {/* ---------- Funnel + Verified stories ---------- */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="border-border bg-card rounded-2xl border p-5 lg:col-span-2">
              <p className="font-display text-base font-semibold">
                Conversion funnel
              </p>
              <div className="mt-5 flex flex-col gap-4">
                {FUNNEL.map((f) => {
                  const pct = (f.value / maxFunnel) * 100;
                  return (
                    <div key={f.stage}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-foreground text-[13px]">
                          {f.stage}
                        </span>
                        <span className="text-[12px] tabular-nums">
                          <span className="font-display font-bold">
                            {f.value.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            · {pct >= 1 ? pct.toFixed(0) : pct.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                      <div className="bg-muted mt-1.5 h-2 rounded-full">
                        <div
                          className="bg-pink-gradient h-full rounded-full"
                          style={{ width: `${Math.max(pct, 0.8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="border-border bg-card rounded-2xl border p-5">
              <p className="font-display text-base font-semibold">
                Verified stories
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {VERIFIED_STORIES.map((s) => (
                  <div
                    key={s.handle}
                    className={cn(
                      "relative aspect-[4/5] overflow-hidden rounded-xl bg-gradient-to-br",
                      s.gradient,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold uppercase",
                        tierBadgeClass(s.tier),
                      )}
                    >
                      {s.tier[0]}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2">
                      <p className="text-[11px] leading-tight font-semibold text-white">
                        {s.handle}
                      </p>
                      <p className="text-[9px] text-white/80">{s.ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ---------- Secondary metrics ---------- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SECONDARY_METRICS.map((m) => (
              <Stat key={m.label} {...m} />
            ))}
          </div>

          {/* ---------- Validator activity (live) ---------- */}
          <section className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold">
                  Validator activity
                </p>
                <p className="text-muted-foreground mt-0.5 text-[12px]">
                  Read-only monitor of every WhatsApp validation from your team.
                </p>
              </div>
              <span className="text-whatsapp-deep inline-flex items-center gap-1.5 text-[12px] font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="bg-whatsapp absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                  <span className="bg-whatsapp relative inline-flex h-2 w-2 rounded-full" />
                </span>
                <MessageCircle className="h-3.5 w-3.5" />
                Live
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
              {/* Validator list */}
              <div className="flex flex-col gap-1">
                {VALIDATOR_FEED.map((v) => (
                  <div
                    key={v.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2",
                      v.id === selected.id && "bg-muted",
                    )}
                  >
                    <div className="relative">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white",
                          v.avatarBg,
                        )}
                      >
                        {v.name[0]}
                      </span>
                      <span
                        className={cn(
                          "border-card absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border",
                          v.status === "online" && "bg-whatsapp",
                          v.status === "away" && "bg-amber-400",
                          v.status === "offline" && "bg-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] leading-tight font-semibold">
                        {v.name}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        {v.role} · {v.lastActive}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[12px] font-bold tabular-nums">
                        {v.validated}
                      </span>
                      {v.flagged > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {v.flagged}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat thread */}
              <div className="border-border overflow-hidden rounded-2xl border bg-[#efe7df]/40">
                {/* Header */}
                <div className="border-border bg-card flex items-center justify-between gap-3 border-b px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white",
                        selected.avatarBg,
                      )}
                    >
                      {selected.name[0]}
                    </span>
                    <div>
                      <p className="text-[13px] leading-tight font-semibold">
                        {selected.name} · Mesita 🌳
                      </p>
                      <p className="text-whatsapp-deep text-[10px]">online</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Today · {selected.validated} validated · {selected.flagged}{" "}
                    flagged
                  </p>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-2 p-4">
                  {VALIDATOR_THREAD.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.side === "out" ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-[12px] shadow-sm",
                          m.side === "out"
                            ? "bg-whatsapp/20 text-foreground rounded-br-sm"
                            : "bg-card text-foreground rounded-bl-sm",
                        )}
                      >
                        <p className="leading-snug">{m.text}</p>
                        {m.warning && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            {m.warning}
                          </p>
                        )}
                        <p
                          className={cn(
                            "mt-0.5 text-right text-[9px]",
                            m.side === "out"
                              ? "text-whatsapp-deep/70"
                              : "text-muted-foreground",
                          )}
                        >
                          {m.at}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  delta,
  trend,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
}) {
  return (
    <div className="border-border bg-card rounded-2xl border p-5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="font-display mt-2 text-3xl leading-none font-bold tracking-tight">
        {value}
      </p>
      <p
        className={cn(
          "mt-3 inline-flex items-center gap-1 text-[12px] font-semibold",
          trend === "up" ? "text-whatsapp-deep" : "text-destructive",
        )}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        {delta}
      </p>
    </div>
  );
}
