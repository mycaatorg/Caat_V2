import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/lib/supabaseClient";
import {
  ScholarshipRow,
  formatAmountDisplay,
} from "@/types/scholarships";

interface Props {
  schoolId: number;
  schoolName: string;
}

export async function SchoolScholarshipsSection({ schoolId, schoolName }: Props) {
  const { data, error } = await supabase
    .from("scholarship_schools")
    .select("scholarships(*)")
    .eq("school_id", schoolId);

  if (error) {
    return (
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Scholarships</h2>
        <p className="text-sm text-muted-foreground">
          Couldn&rsquo;t load scholarships right now. Please try again later.
        </p>
      </section>
    );
  }

  // Supabase nests the joined row under .scholarships
  const scholarships = (data ?? [])
    .map((row) => row.scholarships as unknown as ScholarshipRow | null)
    .filter((s): s is ScholarshipRow => s !== null && s.is_active);

  if (scholarships.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold">
          Scholarships at {schoolName}
        </h2>
        <span className="text-sm text-muted-foreground">
          {scholarships.length} available
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scholarships.map((s) => (
          <Card
            key={s.id}
            className="flex flex-col h-full hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base leading-snug line-clamp-2">
                {s.title}
              </CardTitle>
              {s.amount_display ? (
                <CardDescription className="text-sm font-medium text-[#9a1a27]">
                  {formatAmountDisplay(s)}
                </CardDescription>
              ) : null}
            </CardHeader>

            {s.description ? (
              <CardContent className="text-sm text-muted-foreground line-clamp-3">
                {s.description}
              </CardContent>
            ) : null}

            <CardFooter className="mt-auto justify-end gap-2 pt-3">
              <Button asChild size="sm" variant="default">
                <Link href={`/scholarships/${s.id}`}>View Details</Link>
              </Button>
              {s.external_url ? (
                <Button asChild size="icon" variant="outline">
                  <a
                    href={s.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span className="sr-only">Open official page</span>
                  </a>
                </Button>
              ) : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
