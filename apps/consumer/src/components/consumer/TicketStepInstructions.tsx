export function TicketStepInstructions({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;

  if (steps.length === 1) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">{steps[0]}</p>
    );
  }

  return (
    <ol className="text-muted-foreground list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
      {steps.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ol>
  );
}
