import Image from "next/image";
import { Bell, MapPin, Star } from "lucide-react";
import type { ConsumerNotification } from "@/lib/api/notifications";
import { formatPayMx } from "@/lib/api/pay";

function kindLabel(kind: string): string {
  if (kind === "bill") return "Your bill";
  if (kind === "review") return "Review update";
  return "Update";
}

function KindIcon({ kind, className }: { kind: string; className?: string }) {
  if (kind === "review") return <Star className={className} />;
  return <Bell className={className} />;
}

export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const p = n.bill;
  const reward =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  return (
    <article className="border-border bg-card flex gap-3 overflow-hidden rounded-2xl border p-3">
      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
        {p.place_photo_url ? (
          <Image
            src={p.place_photo_url}
            alt=""
            fill
            className="object-cover"
            sizes="64px"
          />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            <MapPin className="h-5 w-5 opacity-40" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-sm leading-snug font-semibold">
            {p.place_name ?? "Mesita partner"}
          </p>
        </div>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[12px]">
          <KindIcon kind={n.kind} className="h-3.5 w-3.5 shrink-0" />
          {kindLabel(n.kind)}
        </p>
        {reward > 0 ? (
          <p className="text-secondary mt-1 text-[12px] font-medium">
            Reward {formatPayMx(reward, p.currency)}
          </p>
        ) : null}
        <p className="text-muted-foreground mt-1 text-[10px]">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
    </article>
  );
}
