export default function AdminPlaceLoading() {
  return (
    <div className="mx-auto w-full px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <span className="sr-only">Loading place</span>
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="bg-muted h-10 w-72 animate-pulse rounded-xl" />
        <div className="bg-muted h-9 w-full animate-pulse rounded-full" />
        <div className="bg-muted h-[260px] animate-pulse rounded-2xl md:h-[300px]" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[132px] animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}
