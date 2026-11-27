import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { Text } from "@/components/text";
import { EdgeError } from "@/lib/edge";
import { colors, radius, space } from "@/theme";

import { answerBill, money, readPayCode, type PayCode, type PayCodeRead } from "../api";
import { clock, codePhase, connectionLine, hidePayable, needsGuest, type GuestBill } from "../visit";

export function CodeScreen({ placeId, onClose }: { placeId: string; onClose: () => void }) {
  const [read, setRead] = useState<PayCodeRead | null>(null);
  const [kept, setKept] = useState<PayCode | null>(null);
  const [misses, setMisses] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [hideWriting, setHideWriting] = useState(false);
  const [why, setWhy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [armedAt, setArmedAt] = useState(0);
  const following = useRef<string | null>(null);
  const seen = useRef("");
  const alive = useRef(true);

  const apply = useCallback((next: PayCodeRead) => {
    setMisses(0);
    setFailed(false);
    if (next.closed) setKept(null);
    else if (next.code) setKept(next.code);
    if (!next.typing) setHideWriting(false);
    if (needsGuest(next.bill)) following.current = next.bill.id;
    const key = `${next.bill ? `${next.bill.id}:${next.bill.state}:${next.bill.version}:${next.bill.waiterReady}` : ""}:${next.typing ? `${next.typing.step}:${next.typing.billCents}:${next.typing.tipCents}` : ""}`;
    if (key !== seen.current) {
      seen.current = key;
      setArmedAt(Date.now() + 1000);
    }
    setRead(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await readPayCode({ billId: following.current ?? undefined });
      if (alive.current) apply(next);
    } catch {
      if (alive.current) setMisses((count) => count + 1);
    }
  }, [apply]);

  const mint = useCallback(async () => {
    try {
      const next = await readPayCode({ mint: true, placeId, billId: following.current ?? undefined });
      if (alive.current) apply(next);
    } catch {
      if (!alive.current) return;
      setFailed(true);
    }
  }, [apply, placeId]);

  useEffect(() => {
    alive.current = true;
    void mint();
    return () => {
      alive.current = false;
    };
  }, [mint]);

  useEffect(() => {
    const code = read?.code ?? kept;
    if (!code || read?.closed) return;
    const wait = Math.max(Date.parse(code.expiresAt) - Date.now() - 60_000, 1000);
    const id = setTimeout(() => void mint(), wait);
    return () => clearTimeout(id);
  }, [read?.code, read?.closed, kept, mint]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const wait = read?.typing ? 250 : needsGuest(read?.bill ?? null) ? 1000 : 3000;
    const tick = () => {
      timer = setTimeout(() => {
        if (stopped) return;
        if (AppState.currentState === "active") void refresh();
        tick();
      }, wait);
    };
    timer = setTimeout(() => {
      if (!stopped && AppState.currentState === "active") void refresh();
      tick();
    }, 1000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [read?.typing, read?.bill, refresh]);

  useEffect(() => {
    if (!needsGuest(read?.bill ?? null)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [read?.bill]);

  const bill = read?.bill ?? null;
  const code = read?.closed ? null : (read?.code ?? kept);
  const phase = codePhase({
    closed: read?.closed === true,
    bill,
    typing: read?.typing ?? null,
    showQr,
    hideWriting,
  });
  const stale = hidePayable(misses);
  const left = bill ? clock(bill.expiresAt, now) : "0:00";

  const answer = async (action: "accept" | "decline" | "not_mine" | "cancel") => {
    if (!bill || busy) return;
    setBusy(action === "not_mine" ? "decline" : action);
    setShowQr(false);
    setNote(null);
    try {
      await answerBill(bill.id, action, bill.version);
      if (action === "not_mine") {
        following.current = null;
        setRead(null);
        setKept(null);
        await mint();
      } else await refresh();
    } catch (error) {
      setNote(error instanceof EdgeError && error.status !== null && error.status < 500 ? "That did not go through." : "No connection.");
      await refresh();
    } finally {
      if (alive.current) {
        setBusy(null);
        setCancelOpen(false);
      }
    }
  };

  const again = () => {
    following.current = null;
    setNote(null);
    setRead(null);
    void mint();
  };

  return (
    <Screen footer={<Footer phase={phase} bill={bill} busy={busy} stale={stale} armed={now < armedAt} onAnswer={(action) => void answer(action)} onQr={() => { setShowQr(true); void mint(); }} onHideQr={() => setShowQr(false)} onWriting={() => setHideWriting(true)} onAgain={again} onCancel={() => setCancelOpen(true)} onClose={onClose} />}>
      {stale ? <Text role="small" tone="muted">{connectionLine(bill)}</Text> : null}
      {phase === "closed" ? <Closed /> : null}
      {phase === "writing" && read?.typing ? <Writing typing={read.typing} currency={bill?.currency ?? "usd"} /> : null}
      {phase === "qr" ? <Qr code={code} failed={failed && !code} open={bill?.state === "open"} onRetry={() => void mint()} /> : null}
      {phase === "over" && bill ? <Over bill={bill} /> : null}
      {phase === "confirming" || phase === "paid" ? <Text role="title">{phase === "paid" ? "Paid" : "Confirming…"}</Text> : null}
      {(phase === "sent" || phase === "accepted" || phase === "paid") && bill?.quote && !stale ? (
        <Ticket bill={bill} onWhy={() => setWhy(true)} />
      ) : null}
      {phase === "sent" || phase === "accepted" ? <Handshake you={bill?.state === "accepted"} waiter={bill?.waiterReady === true} /> : null}
      {phase === "accepted" && !stale ? <Text role="small" tone="muted">Waiting for your waiter · {left}</Text> : null}
      {phase === "sent" && !stale ? (
        <Text role="small" tone="muted">
          Answer in {left}
        </Text>
      ) : null}
      {note ? <Text role="body" tone="danger">{note}</Text> : null}
      <Why open={why} bill={bill} onClose={() => setWhy(false)} />
      <Cancel open={cancelOpen} bill={bill} busy={busy === "cancel"} onKeep={() => setCancelOpen(false)} onCancel={() => void answer("cancel")} />
    </Screen>
  );
}

function Footer({
  phase,
  bill,
  busy,
  stale,
  armed,
  onAnswer,
  onQr,
  onHideQr,
  onWriting,
  onAgain,
  onCancel,
  onClose,
}: {
  phase: string;
  bill: GuestBill | null;
  busy: string | null;
  stale: boolean;
  armed: boolean;
  onAnswer: (action: "accept" | "decline" | "not_mine") => void;
  onQr: () => void;
  onHideQr: () => void;
  onWriting: () => void;
  onAgain: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  if (phase === "writing") return <Button label="Show my QR" kind="quiet" onPress={onWriting} />;
  if (phase === "qr" && bill?.state === "accepted") return <Button label="Back to the bill" kind="quiet" onPress={onHideQr} />;
  if (phase === "closed" || phase === "over") return <Button label="Show my QR" onPress={onAgain} />;
  if (phase === "accepted" && !stale) {
    return (
      <View style={styles.row}>
        <Button label="Show my QR" kind="quiet" onPress={onQr} />
        <Button label="Cancel bill" kind="danger" disabled={busy !== null} onPress={onCancel} />
      </View>
    );
  }
  if (phase === "sent" && bill?.quote && !stale) {
    const owed = bill.quote.outsideCents;
    const label = owed === 0 ? "Use my credits" : `I paid ${money(owed, bill.currency)}`;
    return (
      <View style={styles.payRow}>
        <Button label={busy === "decline" ? "Declining" : "Decline"} kind="quiet" busy={busy === "decline"} disabled={busy !== null} onPress={() => onAnswer("decline")} />
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy !== null || armed} onPress={() => onAnswer("accept")} style={styles.pay}>
          <Text role="label" tone="onPay">{busy === "accept" ? "Confirming" : label}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => onAnswer("not_mine")} style={styles.notMine}>
          <Text role="small">Not my bill</Text>
        </Pressable>
      </View>
    );
  }
  return <Button label="Close" kind="secondary" onPress={onClose} />;
}

function Closed() {
  return (
    <View style={styles.center}>
      <Text role="title">Ticket closed</Text>
      <Text role="body">Too many wrong waiter codes.</Text>
      <Text role="small" tone="muted">Nothing was paid. Show a new QR to try again.</Text>
    </View>
  );
}

function Writing({ typing, currency }: { typing: { billCents: number; tipCents: number; step: "bill" | "tip" | "code" }; currency: string }) {
  const coding = typing.step === "code" && typing.billCents === 0;
  const words = coding ? "Your waiter is entering their code" : typing.step === "bill" ? "Your waiter is writing your bill" : typing.step === "tip" ? "Your waiter is writing the tip" : "Your bill is ready";
  return (
    <View style={styles.center}>
      <Text role="caption" style={styles.live}>Live</Text>
      <Text role="body" tone="muted">{words}</Text>
      <Text role="title">{money(typing.billCents + typing.tipCents, currency)}</Text>
      <Text role="small" tone="muted">You check it and pay next. Nothing is paid yet.</Text>
    </View>
  );
}

function Qr({ code, failed, open, onRetry }: { code: PayCode | null; failed: boolean; open: boolean; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text role="heading">Show this to your waiter</Text>
      {open ? <Text role="small" tone="muted">Your waiter has your bill open</Text> : null}
      {code ? (
        <View accessibilityLabel="Your Mesita QR" style={styles.qr}>
          <QRCode value={code.url} size={240} color={colors.ink} backgroundColor={colors.paper} />
        </View>
      ) : failed ? (
        <Button label="Try again" kind="quiet" onPress={onRetry} />
      ) : (
        <Text role="body" tone="muted">Loading your QR.</Text>
      )}
    </View>
  );
}

function Over({ bill }: { bill: GuestBill }) {
  const words = bill.state === "declined" ? "You declined this bill." : bill.state === "expired" ? "Time ran out on this bill." : "This bill was cancelled.";
  return (
    <View style={styles.center}>
      <Text role="title">{bill.state === "declined" ? "Declined" : "Not paid"}</Text>
      <Text role="body">{words}</Text>
      <Text role="small" tone="muted">No credits were used. If you already paid, show this screen to the staff.</Text>
    </View>
  );
}

function Ticket({ bill, onWhy }: { bill: GuestBill; onWhy: () => void }) {
  const quote = bill.quote;
  if (!quote) return null;
  const big = money(quote.outsideCents, bill.currency);
  return (
    <View>
      <Text role="strong">{bill.place.name ?? "A Mesita place"}</Text>
      <Text role="title">Pay this to waiter, in cash or card</Text>
      <View style={styles.amount}>
        <Text role="title" tone="onPay">{big}</Text>
      </View>
      <Button label="Why?" kind="secondary" onPress={onWhy} />
    </View>
  );
}

function Handshake({ you, waiter }: { you: boolean; waiter: boolean }) {
  return (
    <View style={styles.handshake}>
      <Text role="strong">{you ? "You · Ready" : "You · Waiting"}</Text>
      <Text role="strong">{waiter ? "Waiter · Ready" : "Waiter · Waiting"}</Text>
    </View>
  );
}

function Why({ open, bill, onClose }: { open: boolean; bill: GuestBill | null; onClose: () => void }) {
  const quote = bill?.quote;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Text role="title">Why?</Text>
        {bill && quote ? (
          <View style={styles.lines}>
            <Line label="Bill" value={money(bill.billCents ?? 0, bill.currency)} />
            {quote.discountCents > 0 ? <Line label={`${quote.discountBps / 100}% Discount`} value={`−${money(quote.discountCents, bill.currency)}`} /> : null}
            {quote.creditCents > 0 ? <Line label="Your credits" value={`−${money(quote.creditCents, bill.currency)}`} /> : null}
            {bill.tipCents > 0 ? <Line label="Tip" value={money(bill.tipCents, bill.currency)} /> : null}
          </View>
        ) : null}
        <Button label="Close" kind="secondary" onPress={onClose} />
      </View>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text role="body">{label}</Text>
      <Text role="strong">{value}</Text>
    </View>
  );
}

function Cancel({ open, bill, busy, onKeep, onCancel }: { open: boolean; bill: GuestBill | null; busy: boolean; onKeep: () => void; onCancel: () => void }) {
  const credits = bill?.quote?.creditCents ?? 0;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onKeep}>
      <View style={styles.sheet}>
        <Text role="title">Cancel this bill?</Text>
        {credits > 0 && bill ? <Text role="body" tone="muted">Your {money(credits, bill.currency)} of credits stay in your Wallet.</Text> : null}
        <Text role="body" tone="danger">Money you already gave the place is not returned by Mesita. Ask the place for it.</Text>
        <Button label={busy ? "Cancelling…" : "Cancel bill"} kind="danger" busy={busy} onPress={onCancel} />
        <Button label="Keep it" kind="secondary" onPress={onKeep} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { gap: space.sm, alignItems: "center" },
  live: { backgroundColor: colors.payLow, overflow: "hidden", borderRadius: radius.panel, paddingHorizontal: space.md, paddingVertical: space.xs },
  qr: { marginTop: space.lg, backgroundColor: colors.paper, padding: space.md },
  amount: { marginVertical: space.md, borderRadius: radius.card, backgroundColor: colors.pay, padding: space.lg, alignItems: "center" },
  handshake: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md },
  row: { gap: space.sm },
  payRow: { gap: space.sm },
  pay: { minHeight: 48, borderRadius: radius.card, backgroundColor: colors.pay, alignItems: "center", justifyContent: "center" },
  notMine: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, backgroundColor: colors.paper, padding: space.lg, gap: space.md },
  lines: { gap: space.sm },
  line: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
});
