export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-3 text-center">
        <span aria-hidden className="text-4xl">
          🌲
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mesita Admin
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Hello, world.
        </p>
      </div>
    </main>
  );
}
