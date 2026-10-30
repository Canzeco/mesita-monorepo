import { Instagram } from "@/components/icons/Instagram";
import { compact, money } from "@/lib/format";
import { guestById, rewardShort, type Visit } from "@/lib/mock";
import { STORY_MIN_FOLLOWERS } from "@/lib/rewards";
import { Avatar, Chip, Row } from "./ui";

export const visitTabs = [
  { href: "/visits", label: "Live" },
  { href: "/visits/history", label: "History" },
  { href: "/visits/settings", label: "Settings" },
];

export function GuestChips({ guestId }: { guestId: string }) {
  const g = guestById(guestId);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {g.vip ? <Chip tone="dark">VIP</Chip> : null}
      {g.instagramFollowers && g.instagramFollowers >= STORY_MIN_FOLLOWERS ? (
        <Chip>
          <Instagram className="size-3" aria-hidden />
          {compact(g.instagramFollowers)}
        </Chip>
      ) : null}
    </span>
  );
}

export function RewardChips({ visit }: { visit: Visit }) {
  if (visit.rewards.applied.length === 0) return <span className="text-muted-foreground">No rewards</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {visit.rewards.applied.map((a) => (
        <Chip key={a.id} tone="brand">
          {rewardShort[a.id]} {a.percent}%{a.mode === "cashback" ? " back" : ""}
        </Chip>
      ))}
    </span>
  );
}

export function statusChip(status: Visit["status"]) {
  if (status === "waiting") return <Chip tone="warning">Waiting</Chip>;
  if (status === "rejected") return <Chip tone="danger">Rejected</Chip>;
  return <Chip tone="success">Approved</Chip>;
}

export function VisitRow({ visit }: { visit: Visit }) {
  const g = guestById(visit.guestId);
  return (
    <Row
      href={`/visits/${visit.id}`}
      leading={<Avatar name={g.name} vip={g.vip} />}
      title={g.name}
      sub={
        <>
          {visit.status !== "approved" ? statusChip(visit.status) : null}
          <span className="truncate">{`${visit.time} · ${visit.party} people · ${visit.paidWith}`}</span>
        </>
      }
      right={money(visit.bill)}
      rightSub={visit.rewards.total > 0 ? `−${money(visit.rewards.total)} rewards` : "No rewards"}
    />
  );
}
