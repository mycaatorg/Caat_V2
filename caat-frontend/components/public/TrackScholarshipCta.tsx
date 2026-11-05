"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { publicScholarshipPath } from "@/lib/public-scholarship-identity";

/**
 * Conversion CTA for a public scholarship page.
 *
 * Renders, server-side and for every logged-out visitor (the target audience
 * and what crawlers see), a link into the signup funnel that returns the
 * visitor to this scholarship after they create an account. If the visitor
 * turns out to be signed in, it swaps to a deep link into their authed tracker
 * for this scholarship. The auth check runs only in the browser, so the page
 * itself stays static and cacheable.
 */
export function TrackScholarshipCta({
  slug,
  scholarshipId,
}: {
  slug: string;
  scholarshipId: string;
}) {
  const signupHref = `/signup?next=${encodeURIComponent(publicScholarshipPath(slug, scholarshipId))}`;
  const [href, setHref] = useState(signupHref);
  const [label, setLabel] = useState("Track this scholarship");

  useEffect(() => {
    let active = true;
    getBrowserClient()
      .auth.getClaims()
      .then(({ data }) => {
        if (!active || !data?.claims) return;
        setHref(`/scholarships/${scholarshipId}`);
        setLabel("Open in your tracker");
      })
      .catch(() => {
        // stay on the signup CTA if the auth check fails
      });
    return () => {
      active = false;
    };
  }, [scholarshipId]);

  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center bg-[#9a1a27] text-white text-xs tracking-widest uppercase px-8 py-3.5 border border-[#9a1a27] rounded-md hover:bg-white hover:text-[#9a1a27] transition-colors duration-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2 font-code"
    >
      {label}
    </Link>
  );
}
