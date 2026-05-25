export function StatusBar() {
  return (
    <div className="text-foreground hidden h-7 items-center justify-between px-6 pt-2 text-[12px] font-semibold tabular-nums md:flex">
      <span>9:41</span>
      <div className="flex items-center gap-1 text-[10px]">
        <span className="tracking-wider">●●●●</span>
        <span>100%</span>
      </div>
    </div>
  );
}
