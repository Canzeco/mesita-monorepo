import { BONE_CLASS } from "@/components/admin-ui/manage";
import { PAGE_BAND_CLASS, PageContainer } from "@/components/PageContainer";

// Any page while it loads (MESITA-3261): an empty band and a soft grey body.
// Without it the previous page stays painted after a rail click.
export default function AppLoading() {
  return (
    <PageContainer className="flex flex-col gap-6 sm:gap-8">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div aria-hidden className={PAGE_BAND_CLASS}>
        <div className="flex flex-col gap-1.5">
          <div className={`${BONE_CLASS} h-8 w-40`} />
          <div className={`${BONE_CLASS} h-4 w-72 max-w-full`} />
        </div>
      </div>
      <div aria-hidden className={`${BONE_CLASS} h-64 w-full rounded-2xl`} />
    </PageContainer>
  );
}
