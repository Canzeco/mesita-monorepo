/**
 * The weights line for a mode that cannot be tuned. One sentence where the
 * control would be, never a control — the same rule `FloorSoonNote` follows
 * for a Soon source, and the same 2026-08-21 law ConfigSoon states in its own
 * header: the knobs for an engine that does not exist are DELETED from the
 * markup, not staged.
 *
 * A staged weight column would be worse than a staged floor. Weights are
 * stored as `Π s^w` exponents, so an operator who typed one here and saw it
 * persist would reasonably believe the deck had changed. It would not have.
 */
export function NoWeightsNote({ reason }: { reason: string }) {
  return (
    <p className="text-muted-foreground/80 max-w-md type-meta">
      Weights: none. {reason}
    </p>
  );
}
