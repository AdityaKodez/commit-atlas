import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { SetupCard } from "@/components/setup-card";
import { SiteView } from "@/components/site-view";
import { getCachedSiteData } from "@/lib/github";

/** The initial render and browser refreshes share the same backend cache. */
export const revalidate = 600;

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const site = await getCachedSiteData();

  if (!site.profile && site.repos.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <SetupCard />
      </main>
    );
  }

  return <SiteView initial={site} />;
}
