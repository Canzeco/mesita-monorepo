import Image from "next/image";
import { redirect } from "next/navigation";
import { Plus, Phone, MessageCircle, Crown, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/manager/Topbar";
import { TEAM, VALIDATORS } from "@/lib/manager-data";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/manager/sign-in?next=/manager/team");

  return (
    <>
      <Topbar title="Team" subtitle="Managers and WhatsApp validators" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
          <div className="border-secondary/40 bg-secondary/5 text-secondary rounded-2xl border border-dashed px-4 py-3 text-[12px]">
            Preview — the team data below is a sketch. Real member + validator
            management lands after the manager-list-team Edge Function is wired
            up.
          </div>
          <section className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                  Managers · Full access
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Can edit place, membership, rewards, wallet, and team.
                </p>
              </div>
              <button className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold">
                <Plus className="h-3 w-3" />
                Invite manager
              </button>
            </div>
            <div className="divide-border mt-4 divide-y">
              {TEAM.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full">
                    <Image
                      src={m.avatar}
                      alt={m.name}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold">{m.name}</p>
                      {m.role === "Owner" && (
                        <span className="bg-tier-gold/40 text-foreground inline-flex items-center gap-0.5 rounded-md px-1.5 py-0 text-[9px] font-bold tracking-wider uppercase">
                          <Crown className="h-2.5 w-2.5" />
                          Owner
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {m.role}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-[11px]">
                    Active {m.lastActive}
                  </span>
                  <button className="border-border text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="border-border bg-card rounded-2xl border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
                  WhatsApp validators
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Waiters and hosts who scan guest QRs from their own phone.
                </p>
              </div>
              <button className="bg-whatsapp-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold text-white shadow-sm">
                <MessageCircle className="h-3 w-3" />
                Add validator
              </button>
            </div>
            <div className="divide-border mt-4 divide-y">
              {VALIDATORS.map((w) => (
                <div key={w.id} className="flex items-center gap-3 py-3">
                  <span className="bg-whatsapp/15 text-whatsapp-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {w.name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{w.name}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {w.role}
                    </p>
                  </div>
                  <p className="text-muted-foreground hidden font-mono text-[12px] md:block">
                    <Phone className="text-whatsapp mr-1.5 inline-block h-3 w-3 align-text-bottom" />
                    {w.phone}
                  </p>
                  <span className="text-muted-foreground text-[11px]">
                    Active {w.lastActive}
                  </span>
                  <button className="border-border text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-full border">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="border-border text-muted-foreground rounded-2xl border border-dashed p-5 text-center text-[13px]">
            Validators only need to follow{" "}
            <span className="text-whatsapp-deep font-semibold">
              @mesita.bot
            </span>{" "}
            on WhatsApp and send <span className="font-mono">VERIFY</span>. No
            app install, no training.
          </section>
        </div>
      </div>
    </>
  );
}
