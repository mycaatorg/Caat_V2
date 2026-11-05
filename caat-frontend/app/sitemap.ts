import type { MetadataRoute } from "next";
import { getPublicScholarshipSlugs } from "@/lib/public-scholarships";
import { publicScholarshipPath } from "@/lib/public-scholarship-identity";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mycaat.com";

// Public, crawlable routes only. The authenticated (main) app group is
// per-user and behind login, so it is excluded here and disallowed in robots.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: {
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/scholarship", changeFrequency: "daily", priority: 0.9 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.9 },
    { path: "/login", changeFrequency: "monthly", priority: 0.7 },
    { path: "/help", changeFrequency: "monthly", priority: 0.6 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map(
    ({ path, changeFrequency, priority }) => ({
      url: new URL(path, siteUrl).toString(),
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  // One entry per public scholarship detail page. ~4,200 URLs, well under the
  // 50k single-sitemap limit, so they ship in one file. If the query fails, the
  // sitemap still returns the static routes rather than erroring.
  let scholarshipEntries: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getPublicScholarshipSlugs();
    const counts = new Map<string, number>();
    for (const { slug } of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    scholarshipEntries = slugs.map(({ id, slug, updated_at }) => ({
      url: new URL(publicScholarshipPath(slug, counts.get(slug)! > 1 ? id : undefined), siteUrl).toString(),
      lastModified: updated_at ? new Date(updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
  } catch {
    scholarshipEntries = [];
  }

  return [...staticEntries, ...scholarshipEntries];
}
