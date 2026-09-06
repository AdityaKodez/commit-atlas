import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { SetupCard } from "@/components/setup-card";
import { SiteView } from "@/components/site-view";
import { getSiteData } from "@/lib/github";

/**
 * The static export runs this once at build time; SiteView then refreshes
 * the same data live in the browser through the here.now proxy route, so
 * the published site follows new pushes without a republish.
 */
export const revalidate = 1800;

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const site = await getSiteData();

  if (!site.profile && site.repos.length === 0) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <SetupCard />
      </main>
    );
  }

  return <SiteView initial={site} />;
}
