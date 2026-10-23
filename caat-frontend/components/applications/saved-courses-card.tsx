"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CourseSource, ProviderLink } from "@/components/courses/course-source";
import type { HubCourse } from "@/lib/course-data";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

/**
 * PROD-148: the courses the student saved at this university, on the hub.
 * Shows only recorded catalogue facts: the official route (or that none is
 * recorded), a safe application link, and the source with its verification
 * date and freshness. It is not a preparation step and never changes the
 * checklist score. A failed read says so with Retry, never "none saved".
 */
export function SavedCoursesCard({ schoolName, courses, unavailable, retrying, onRetry, checkedAt }: {
  schoolName: string;
  courses: HubCourse[];
  unavailable: boolean;
  retrying: boolean;
  onRetry: () => void;
  checkedAt: string;
}) {
  const title = `Courses you saved at ${schoolName}`;
  return (
    <Card className="shadow-sm" role="region" aria-label={title} data-saved-courses>
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
        <CardTitle className="text-base" data-card-title>{title}</CardTitle>
        <Link href="/courses" className={`shrink-0 text-sm ${MAROON} hover:underline`}>
          Browse courses
        </Link>
      </CardHeader>
      <CardContent>
        {unavailable ? (
          <div role="status" className="rounded-lg border border-dashed bg-muted/20 px-6 py-6 text-center text-sm text-muted-foreground">
            <p>Couldn&apos;t load your saved courses.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-none"
              disabled={retrying}
              aria-label="Retry loading saved courses"
              onClick={onRetry}
            >
              {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Retry
            </Button>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-6 text-center text-sm text-muted-foreground">
            <p>You haven&apos;t saved a course at {schoolName}.</p>
            <Link href="/courses" className={`mt-1 inline-block ${MAROON} hover:underline`}>
              Browse university courses
            </Link>
          </div>
        ) : (
          <ul className="divide-y">
            {courses.map((c) => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0 min-w-0">
                <Link href={`/courses?course=${encodeURIComponent(c.id)}`} className="font-medium text-sm hover:underline break-words">
                  {c.name}
                </Link>
                {c.campus ? <p className="text-xs text-muted-foreground">{c.campus}</p> : null}
                {!c.active ? (
                  <p className="text-xs text-muted-foreground mt-1">No longer in the active catalogue. Check current availability.</p>
                ) : null}
                <dl className="mt-2 space-y-2 text-sm">
                  <div>
                    <dt className="font-code text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70">Official application route</dt>
                    <dd className="text-muted-foreground break-words">
                      {c.application_route ?? "Application route not recorded. Check the provider."}
                      {c.application_url ? (
                        <>
                          {" "}
                          <ProviderLink href={c.application_url}>Official application page<span className="sr-only"> for {c.name}</span></ProviderLink>
                        </>
                      ) : null}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2">
                  <CourseSource course={c} checkedAt={checkedAt} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
