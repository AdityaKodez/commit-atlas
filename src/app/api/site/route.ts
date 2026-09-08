import { connection } from "next/server";
import { getCachedSiteData } from "@/lib/github";

export async function GET() {
  await connection();
  try {
    const site = await getCachedSiteData();
    if (!site.profile && site.repos.length === 0) {
      return Response.json(
        { error: "GitHub data is not configured or currently unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(site, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "GitHub data is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
