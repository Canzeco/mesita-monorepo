"use client";

import { useState } from "react";
import { TestBand } from "@mesita/place-profile";
import { ArrowLeftIcon, CreditCardIcon, GiftIcon, PlusIcon, TicketIcon, WalletIcon } from "@phosphor-icons/react";
import { Card } from "@/components/shell/Page";
import { Switch } from "@/components/ui/config";
import { CTA_BUTTON_CLASS, PILL_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

// THE FIVE FRAMES OF PATO'S SKETCH (MESITA-3377), one page that switches
// between them: Wallet (ways to pay, cards, credits), the place's credits
// (balance, pending with a ready-in counter, the places strip, the
// transactions), Buy credits (the packs with their bonus, for me or for a
// gift, checkout, Pay), Gift credits (an amount, a 10-digit code to share)
// and Redeem (a 10-digit code, the gift, Redeem). Every number is a sample:
// nothing here reads or writes a server, and the TEST band says so.

type View = "wallet" | "place" | "buy" | "gift" | "redeem";

const ROW = "flex min-h-14 items-center gap-3 px-5 py-3 text-sm sm:px-6";
const HEAD = "flex items-center justify-between gap-3 px-5 py-4 sm:px-6";
const TITLE = "font-sans text-sm font-medium tracking-normal";
const TILE = "border-border rounded-xl border p-4";

/** The packs, the Rewards tab's standard three plus a custom amount. */
const PACKS = [
  { key: "200", pay: "MX$200", get: "MX$220", bonus: "10% Bonus" },
  { key: "1000", pay: "MX$1,000", get: "MX$1,200", bonus: "20% Bonus" },
  { key: "5000", pay: "MX$5,000", get: "MX$6,500", bonus: "30% Bonus" },
] as const;

const PLACES = ["Taquería Orinoco (Centrito Valle)", "Taquería Orinoco (TEC)", "Pangea"];

const TRANSACTIONS = [
  { what: "Bought Standard Medium", when: "Today, 12:40", amount: "+MX$1,200", pending: true },
  { what: "Gifted to a guest · code 4F7K 29QX 2M", when: "Yesterday", amount: "−MX$200" },
  { what: "Redeemed by a guest", when: "Tuesday", amount: "−MX$130" },
  { what: "Cashback to a guest", when: "Monday", amount: "−MX$9" },
];

export function WalletMock({ placeId }: { placeId: string }) {
  const [view, setView] = useState<View>("wallet");
  const [ways, setWays] = useState({ cash: true, cards: true, credits: false });
  const [pack, setPack] = useState<string>("1000");
  const [custom, setCustom] = useState("");
  const [forGift, setForGift] = useState(false);
  const [giftAmount, setGiftAmount] = useState("200");
  const [code, setCode] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  void placeId;

  const back = (to: View, label: string) => (
    <button type="button" onClick={() => setView(to)} className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
      <ArrowLeftIcon className="size-4" aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 pb-8">
      <TestBand detail="A mock of the sketch: every number is a sample and nothing here is live." />

      {view === "wallet" ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <Card className="p-0 sm:p-0">
            <div className={HEAD}>
              <h2 className={TITLE}>Ways to pay</h2>
            </div>
            <ul className="divide-border border-border divide-y border-t">
              {(
                [
                  ["cash", "Cash", "At the table, as always."],
                  ["cards", "Cards", "By card, through Mesita Pay."],
                  ["credits", "Credits", "Credit a guest bought or was gifted."],
                ] as const
              ).map(([key, name, line]) => (
                <li key={key} className={ROW}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{name}</p>
                    <p className="text-muted-foreground">{line}</p>
                  </div>
                  <Switch on={ways[key]} pending={false} label={name} onClick={() => setWays((w) => ({ ...w, [key]: !w[key] }))} />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-0 sm:p-0">
            <div className={HEAD}>
              <h2 className={TITLE}>Cards</h2>
              <button type="button" className={PILL_BUTTON_CLASS}>
                <PlusIcon className="size-3.5" aria-hidden />
                Add
              </button>
            </div>
            <ul className="divide-border border-border divide-y border-t">
              <li className={ROW}>
                <span className="bg-muted grid size-10 shrink-0 place-items-center rounded-xl">
                  <CreditCardIcon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Visa •••• 4242</p>
                  <p className="text-muted-foreground">Expires 09/28 · for buying credits</p>
                </div>
              </li>
            </ul>
          </Card>

          <Card className="p-0 sm:p-0 lg:col-span-2">
            <div className={HEAD}>
              <h2 className={TITLE}>Credits</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={PILL_BUTTON_CLASS} onClick={() => setView("buy")}>
                  <WalletIcon className="size-3.5" aria-hidden />
                  Buy
                </button>
                <button type="button" className={PILL_BUTTON_CLASS} onClick={() => setView("gift")}>
                  <GiftIcon className="size-3.5" aria-hidden />
                  Gift
                </button>
                <button type="button" className={PILL_BUTTON_CLASS} onClick={() => setView("redeem")}>
                  <TicketIcon className="size-3.5" aria-hidden />
                  Redeem
                </button>
              </div>
            </div>
            <ul className="divide-border border-border divide-y border-t">
              <li className={ROW}>
                <button type="button" onClick={() => setView("place")} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{PLACES[0]}</p>
                    <p className="text-muted-foreground">MX$1,200 available · MX$220 pending, ready in 42 min</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">MX$1,420</p>
                </button>
              </li>
            </ul>
          </Card>
        </div>
      ) : null}

      {view === "place" ? (
        <div className="flex flex-col gap-4">
          {back("wallet", "Wallet")}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold tracking-tight">{PLACES[0]}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className={TILE}>
                  <p className="text-muted-foreground text-sm">Credits balance</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">MX$1,200</p>
                </div>
                <div className={TILE}>
                  <p className="text-muted-foreground text-sm">Pending credits</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">MX$220</p>
                  <p className="text-muted-foreground text-sm">Ready in 42 min</p>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PLACES.map((name, i) => (
                  <span key={name} className={cn("border-border shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap", i === 0 && "bg-foreground text-paper border-foreground")}>
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={CTA_BUTTON_CLASS} onClick={() => setView("buy")}>Buy credits</button>
                <button type="button" className={cn(CTA_BUTTON_CLASS, "bg-muted text-foreground")} onClick={() => setView("gift")}>Gift credits</button>
              </div>
            </Card>
            <Card className="p-0 sm:p-0">
              <div className={HEAD}>
                <h2 className={TITLE}>Transactions</h2>
                <p className="text-muted-foreground text-sm">Newest first</p>
              </div>
              <ul className="divide-border border-border divide-y border-t">
                {TRANSACTIONS.map((t) => (
                  <li key={t.what} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.what}</p>
                      <p className="text-muted-foreground">
                        {t.when}
                        {t.pending ? " · ready in 42 min" : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{t.amount}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {view === "buy" ? (
        <div className="flex flex-col gap-4">
          {back("wallet", "Wallet")}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold tracking-tight">Buy credits</h2>
              <div className="grid grid-cols-2 gap-3">
                {PACKS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPack(p.key)}
                    className={cn(TILE, "text-left transition", pack === p.key ? "border-foreground ring-foreground ring-1" : "hover:bg-muted/50")}
                  >
                    <p className="text-muted-foreground text-sm">Pay {p.pay}</p>
                    <p className="text-lg font-semibold tabular-nums">Get {p.get}</p>
                    <p className="mt-1 text-sm font-semibold">{p.bonus}</p>
                  </button>
                ))}
                <label className={cn(TILE, "flex flex-col gap-1", pack === "custom" && "border-foreground ring-foreground ring-1")}>
                  <span className="text-muted-foreground text-sm">Custom</span>
                  <input
                    inputMode="numeric"
                    placeholder="MX$"
                    value={custom}
                    onFocus={() => setPack("custom")}
                    onChange={(e) => setCustom(e.target.value)}
                    className="border-border rounded-lg border px-3 py-2 text-base tabular-nums outline-none"
                  />
                  <span className="text-muted-foreground text-sm">The bonus follows the pack it reaches.</span>
                </label>
              </div>
              <div className="bg-muted grid grid-cols-2 gap-1 rounded-full p-1">
                {(["me", "gift"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForGift(k === "gift")}
                    className={cn("rounded-full py-2 text-sm font-semibold transition", (k === "gift") === forGift ? "bg-card shadow-sm" : "text-muted-foreground")}
                  >
                    {k === "me" ? "For me" : "For a gift"}
                  </button>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className={TITLE}>Checkout</h2>
              <ul className="divide-border border-border divide-y rounded-xl border text-sm">
                <li className="flex justify-between px-4 py-3"><span>You pay</span><span className="font-semibold tabular-nums">{pack === "custom" ? (custom ? `MX$${custom}` : "—") : PACKS.find((p) => p.key === pack)?.pay}</span></li>
                <li className="flex justify-between px-4 py-3"><span>You get</span><span className="font-semibold tabular-nums">{pack === "custom" ? "—" : PACKS.find((p) => p.key === pack)?.get}</span></li>
                <li className="flex justify-between px-4 py-3"><span>For</span><span className="font-semibold">{forGift ? "A gift code" : PLACES[0]}</span></li>
                <li className="flex justify-between px-4 py-3"><span>Ready</span><span className="font-semibold">In 1 hour</span></li>
                <li className="flex justify-between px-4 py-3"><span>Card</span><span className="font-semibold">Visa •••• 4242</span></li>
              </ul>
              <button type="button" className={cn(CTA_BUTTON_CLASS, "justify-center bg-green-400 text-neutral-950")} onClick={() => setView(forGift ? "gift" : "place")}>
                Pay
              </button>
              <p className="text-muted-foreground text-sm">Charged once by Stripe, in pesos. Mesita&apos;s fee is 5%.</p>
            </Card>
          </div>
        </div>
      ) : null}

      {view === "gift" ? (
        <div className="flex flex-col gap-4">
          {back("wallet", "Wallet")}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold tracking-tight">Gift credits</h2>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">How much to send</span>
                <input inputMode="numeric" value={giftAmount} onChange={(e) => setGiftAmount(e.target.value)} className="border-border rounded-lg border px-3 py-2 text-base tabular-nums outline-none" />
              </label>
              <p className="text-muted-foreground text-sm">From your MX$1,200 balance at {PLACES[0]}. The guest redeems the code on Mesita and the credit is theirs to spend here.</p>
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className={TITLE}>Gift code</h2>
              <div className={cn(TILE, "bg-muted/40 text-center")}>
                <p className="text-muted-foreground text-sm">MX${giftAmount || "0"} at {PLACES[0]}</p>
                <p className="mt-2 font-mono text-2xl font-semibold tracking-widest tabular-nums">4F7K 29QX 2M</p>
              </div>
              <button type="button" className={cn(CTA_BUTTON_CLASS, "justify-center")}>Share gift code</button>
            </Card>
          </div>
        </div>
      ) : null}

      {view === "redeem" ? (
        <div className="flex flex-col gap-4">
          {back("wallet", "Wallet")}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold tracking-tight">Redeem credits</h2>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">The guest&apos;s 10-digit code</span>
                <input
                  value={code}
                  maxLength={12}
                  placeholder="XXXX XXXX XX"
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setRedeemed(false);
                  }}
                  className="border-border rounded-lg border px-3 py-2 font-mono text-base tracking-widest uppercase outline-none"
                />
              </label>
            </Card>
            <Card className="flex flex-col gap-4">
              <h2 className={TITLE}>The gift</h2>
              <div className={cn(TILE, "bg-muted/40")}>
                {code.replace(/\s/g, "").length >= 10 ? (
                  <>
                    <p className="text-2xl font-semibold tabular-nums">MX$220</p>
                    <p className="text-muted-foreground text-sm">At {PLACES[0]} · from Pato · ready now</p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Type the code to see the gift.</p>
                )}
              </div>
              <button
                type="button"
                className={cn(CTA_BUTTON_CLASS, "justify-center")}
                disabled={code.replace(/\s/g, "").length < 10 || redeemed}
                onClick={() => setRedeemed(true)}
              >
                {redeemed ? "Redeemed" : "Redeem credits"}
              </button>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
