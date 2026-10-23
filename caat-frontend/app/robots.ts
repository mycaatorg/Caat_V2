import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.mycaat.com";

// Allow crawling of the public marketing, auth entry, and legal pages.
// Disallow the authenticated app (the (main) route group) and the password
// reset flows, which are per-user and gated behind login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/today",
        "/shortlist",
        "/welcome",
        "/dashboard",
        "/profile",
        "/applications",
        "/schools",
        "/scholarships",
        "/majors",
        "/essays",
        "/documents",
        "/resume-builder",
        "/communities",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
    host: siteUrl,
  };
}
