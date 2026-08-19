"use client";

// Orders Config — the remote context's policy. WHOLE-BLOB save (the quotas are
// a related pair), `dirty` gates on loadError so a failed read can never
// overwrite the live singleton (MESITA-737), and every knob carries a STAGED
// badge because no order rail exists yet. House rule: an unenforced config is
// a bug — a staged one has to say so out loud.

import { useState, useTransition } from "react";
import {
  Bike,
  CalendarClock,
  Coins,
  Link2,
  MessageCircle,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  Store,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import {
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { getOrdersConfig, updateOrdersConfig } from "./actions";
import type { OrdersChannels, OrdersConfig } from "./defaults";

function StagedBadge() {
  return (
    <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      Staged
    </span>
  );
}

const CHANNELS: {
  key: keyof OrdersChannels;
  label: string;
  blurb: string;
  Icon: typeof Link2;
}[] = [
  {
    key: "externalLink",
    label: "The place's own link",
    Icon: Link2,
    blurb:
      "The guest is handed off to whatever the place already sells through — its site or an aggregator. The only channel that needs no new rail, and the only honest way to start: Mesita never touches the money, so the reward has to hang off a posted receipt.",
  },
  {
    key: "inHouse",
    label: "Mesita cart and checkout",
    Icon: ShoppingCart,
    blurb:
      "Mesita takes the order and the payment. The largest of the three to build — it makes Mesita merchant of record, which brings a menu, stock, refunds and a tax position with it. Off until that is a decision, not a toggle.",
  },
  {
    key: "whatsapp",
    label: "A message to the place",
    Icon: MessageCircle,
    blurb:
      "The order is a WhatsApp thread with the venue. Cheap to ship and how most of the market already orders, but nothing about it is machine-readable, so eligibility rests entirely on the receipt.",
  },
];

export function OrdersConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: {
  initialConfig: OrdersConfig;
  initialUpdatedAt: string | null;
  loadError: string | null;
}) {
  const [cfg, setCfg] = useState<OrdersConfig>(initialConfig);
  const [saved, setSaved] = useState<OrdersConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(loadError);
  const [ok, setOk] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  const patch = (p: Partial<OrdersConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, ...p }));
  };
  const patchChannel = (key: keyof OrdersChannels) => {
    setOk(false);
    setCfg((c) => ({
      ...c,
      channels: { ...c.channels, [key]: !c.channels[key] },
    }));
  };

  // Reported, never auto-corrected — the Filters Config rule. Both of these
  // are savable states that simply cannot serve a guest.
  const noChannel =
    cfg.enabled && !Object.values(cfg.channels).some(Boolean)
      ? "Orders are on with no channel — a guest would have no way to place one."
      : null;
  const noFulfilment =
    cfg.enabled && !cfg.delivery && !cfg.pickup
      ? "Neither delivery nor pickup counts, so no order could ever be eligible."
      : null;

  const save = () => {
    setError(null);
    startTransition(async () => {
      // Premium may never allow fewer orders than Free, or the paid plan
      // would take a perk away. Clamped here and again in the EF.
      const next: OrdersConfig = {
        ...cfg,
        monthlyQuotaPremium: Math.max(
          cfg.monthlyQuotaFree,
          cfg.monthlyQuotaPremium,
        ),
      };
      const r = await updateOrdersConfig(next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(true);
    });
  };

  const reload = () => {
    setError(null);
    startTransition(async () => {
      const r = await getOrdersConfig();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCfg(r.config);
      setSaved(r.config);
      setUpdatedAt(r.updatedAt);
      setOk(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<ShoppingBag className="h-4 w-4" />}
        title="The order context"
        subtitle="Off means Mesita has one context: the visit. This switch is what un-parks the other."
        status={<StagedBadge />}
      >
        <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Orders exist</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              When on, a guest can be rewarded without walking in. Three
              surfaces already promise it and all three say soon: the Premium
              perk list, the consumer Inbox&rsquo;s Orders section, and the
              parked orders column of the Promos grid. Turning this on before
              the rail exists changes nothing on its own.
            </p>
          </div>
          <Switch
            on={cfg.enabled}
            pending={pending}
            onClick={() => patch({ enabled: !cfg.enabled })}
            label="Enable orders"
          />
        </div>
        {noChannel || noFulfilment ? (
          <p className="border-border bg-muted/40 text-muted-foreground mt-3 rounded-xl border border-dashed p-3 text-xs leading-relaxed">
            {noChannel ?? noFulfilment}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        icon={<Store className="h-4 w-4" />}
        title="Channels"
        subtitle="How a guest places an order. More than one may be on; a place uses whichever it actually has."
        status={<StagedBadge />}
      >
        <div className="flex flex-col gap-3">
          {CHANNELS.map((c) => (
            <div
              key={c.key}
              className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <c.Icon className="h-4 w-4 shrink-0" />
                  {c.label}
                </p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {c.blurb}
                </p>
              </div>
              <Switch
                on={cfg.channels[c.key]}
                pending={pending}
                onClick={() => patchChannel(c.key)}
                label={c.label}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Bike className="h-4 w-4" />}
        title="Fulfilment"
        subtitle="Which ways of receiving an order count as one. Both off means nothing is ever eligible."
        status={<StagedBadge />}
      >
        <div className="flex flex-col gap-3">
          <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Delivery</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                The order comes to the guest. The reward window has to cover a
                late delivery, so this is the knob the window below is set for.
              </p>
            </div>
            <Switch
              on={cfg.delivery}
              pending={pending}
              onClick={() => patch({ delivery: !cfg.delivery })}
              label="Delivery"
            />
          </div>
          <div className="border-border bg-background flex items-center justify-between gap-4 rounded-xl border p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Pickup</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                The guest collects it. Borderline by design: they do come to the
                place, but there is no table and no ticket, so it is priced as
                an order and not as a visit.
              </p>
            </div>
            <Switch
              on={cfg.pickup}
              pending={pending}
              onClick={() => patch({ pickup: !cfg.pickup })}
              label="Pickup"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Coins className="h-4 w-4" />}
        title="Quotas"
        subtitle="Rewarded orders per consumer per month, by plan. This is the number the Premium sheet promises a subscriber."
        status={<StagedBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Coins className="h-4 w-4" />}
            label="Free plan"
            value={cfg.monthlyQuotaFree}
            min={0}
            max={1000}
            disabled={pending}
            onChange={(v) => patch({ monthlyQuotaFree: Math.round(v) })}
          />
          <NumberField
            icon={<Coins className="h-4 w-4" />}
            label="Premium plan"
            value={cfg.monthlyQuotaPremium}
            min={0}
            max={1000}
            disabled={pending}
            onChange={(v) => patch({ monthlyQuotaPremium: Math.round(v) })}
          />
        </div>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Saving clamps Premium up to the Free quota — a paid plan that allows
          fewer orders than the free one is a perk taken away, not a setting.
          The consumer plan sheet states 30 a month in copy; move this and that
          string goes stale.
        </p>
      </SectionCard>

      <SectionCard
        icon={<ReceiptText className="h-4 w-4" />}
        title="Eligibility"
        subtitle="What makes an order rewardable at all."
        status={<StagedBadge />}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField
            icon={<Coins className="h-4 w-4" />}
            label="Minimum order (MXN)"
            value={cfg.minOrderMxn}
            min={0}
            max={100000}
            disabled={pending}
            onChange={(v) => patch({ minOrderMxn: Math.round(v) })}
          />
          <NumberField
            icon={<CalendarClock className="h-4 w-4" />}
            label="Claim window (hours)"
            value={cfg.rewardWindowHours}
            min={1}
            max={720}
            disabled={pending}
            onChange={(v) => patch({ rewardWindowHours: Math.round(v) })}
          />
        </div>

        <div className="border-border bg-background mt-3 flex items-center justify-between gap-4 rounded-xl border p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold">A receipt is required</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              A remote order has no QR and no staff at the table, so the receipt
              is the only evidence the order happened. Off would pay on the
              guest&rsquo;s word alone — which is defensible for a visit, where
              someone was there, and not for an order.
            </p>
          </div>
          <Switch
            on={cfg.requireProof}
            pending={pending}
            onClick={() => patch({ requireProof: !cfg.requireProof })}
            label="Require a receipt"
          />
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadError}
      />

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={reload}
          disabled={pending}
          className="hover:text-foreground underline underline-offset-2 disabled:opacity-50"
        >
          Reload
        </button>
        {updatedAt ? (
          <span>Last saved {new Date(updatedAt).toLocaleString()}</span>
        ) : null}
      </div>
    </div>
  );
}
