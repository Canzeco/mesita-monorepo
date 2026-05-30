// Don Memo (Mesita's AI persona) is not live yet. Until the assistant ships
// this surface is a branded "Soon" placeholder — keep the identity (peacock +
// Spanish first-person voice) but no faux-interactive chips or chat input.
export default function AiPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <div className="bg-peacock shadow-glow flex h-16 w-16 items-center justify-center rounded-full text-2xl">
        🦚
      </div>
      <h1 className="font-display mt-5 text-3xl font-semibold tracking-tight">
        Hola, soy Don Memo,
      </h1>
      <p className="text-foreground/80 mt-1 text-sm font-medium">
        la IA de Mesita
      </p>
      <span className="mt-5 inline-flex items-center rounded-full border border-pink-500/30 bg-pink-500/10 px-3.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-pink-600 uppercase">
        Soon
      </span>
      <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
        Pronto vas a poder contarme el plan — vibe, zona y presupuesto — y yo te
        encuentro el lugar.
      </p>
    </div>
  );
}
