export function fallbackAnswer(
  query: string,
  onMesita: number,
  fromGoogle: number,
  placeSeeking: boolean,
): string {
  // Non-place question and no prose -> generic recovery (don't promise spots).
  if (!placeSeeking) {
    return `My brain hiccuped for a second — ask me again in a moment and I'll give you a proper answer.`;
  }
  if (onMesita === 0 && fromGoogle === 0) {
    return `I couldn't pull spots for “${query}” right now — try a place name, a dish, or a neighborhood.`;
  }
  const parts: string[] = [];
  if (onMesita > 0) parts.push(`${onMesita} on Mesita`);
  if (fromGoogle > 0) parts.push(`${fromGoogle} from Google`);
  return `Here's what I'd check out for “${query}” — ${
    parts.join(" and ")
  }. Tap a Google spot's Add and I'll build its Mesita profile.`;
}
