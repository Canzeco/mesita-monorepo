function hash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const FINDER = 8;

export function FakeQR({ seed, size = 21 }: { seed: string; size?: number }) {
  const cells: boolean[][] = [];
  let h = hash(seed);
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      h = Math.imul(h ^ ((x + 1) * 16777619), 2654435761) >>> 0;
      const inFinder =
        (x < FINDER && y < FINDER) ||
        (x >= size - FINDER && y < FINDER) ||
        (x < FINDER && y >= size - FINDER);
      const inLogo =
        x >= Math.floor(size / 2) - 2 &&
        x <= Math.floor(size / 2) + 2 &&
        y >= Math.floor(size / 2) - 2 &&
        y <= Math.floor(size / 2) + 2;
      row.push(!inFinder && !inLogo && (h & 1) === 1);
    }
    cells.push(row);
  }

  const finderSize = `${((FINDER - 1) / size) * 100}%`;

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {cells.flatMap((row, y) =>
          row.map((on, x) => (
            <span key={`${x}-${y}`} className={on ? "bg-foreground" : ""} />
          )),
        )}
      </div>

      {[
        { top: 0, left: 0 },
        { top: 0, right: 0 },
        { bottom: 0, left: 0 },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute"
          style={{ width: finderSize, height: finderSize, ...pos }}
        >
          <div className="border-foreground size-full rounded-[22%] border-[16%]" />
          <div className="bg-foreground absolute inset-[24%] rounded-[22%]" />
        </div>
      ))}
    </div>
  );
}
