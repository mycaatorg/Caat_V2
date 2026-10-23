import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Major } from "@/types/majors";
import { CATEGORY_COLORS } from "@/constants/majors";

interface Props {
  majors: Major[];
}

/**
 * D9 — a real <table> (not a div grid) so screen readers announce row/column
 * associations, wrapped in a horizontal-scroll container with per-column
 * min-widths so columns stay readable on mobile instead of being crushed.
 */
export default function CompareTable({ majors }: Props) {
  const cellPad = "p-4 align-top border-b";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Side-by-side comparison of the selected majors
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="bg-muted/50 p-4 border-b border-r text-left w-44 min-w-44"
            >
              <span className="sr-only">Attribute</span>
            </th>
            {majors.map((major) => (
              <th
                key={major.id}
                scope="col"
                className="bg-muted/50 p-4 border-b border-r last:border-r-0 text-left min-w-56"
              >
                <Link
                  href={`/majors/${major.id}`}
                  className="font-semibold text-base hover:underline underline-offset-2"
                >
                  {major.name}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Category */}
          <tr>
            <th
              scope="row"
              className={`${cellPad} border-r text-left font-medium text-muted-foreground`}
            >
              Category
            </th>
            {majors.map((major) => (
              <td key={major.id} className={`${cellPad} border-r last:border-r-0`}>
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md ${
                    CATEGORY_COLORS[major.category] ??
                    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {major.category}
                </span>
              </td>
            ))}
          </tr>

          {/* Description */}
          <tr>
            <th
              scope="row"
              className={`${cellPad} border-r text-left font-medium text-muted-foreground`}
            >
              Description
            </th>
            {majors.map((major) => (
              <td
                key={major.id}
                className={`${cellPad} border-r last:border-r-0 text-muted-foreground leading-relaxed`}
              >
                {major.description ?? "Not available"}
              </td>
            ))}
          </tr>

          {/* Career Paths */}
          <tr>
            <th
              scope="row"
              className={`${cellPad} border-r text-left font-medium text-muted-foreground`}
            >
              Career Paths
            </th>
            {majors.map((major) => (
              <td key={major.id} className={`${cellPad} border-r last:border-r-0`}>
                {!major.career_paths?.length && <p className="text-muted-foreground">Career information not available</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(major.career_paths ?? []).map((path) => (
                    <span
                      key={path}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs bg-secondary text-secondary-foreground"
                    >
                      {path}
                    </span>
                  ))}
                </div>
              </td>
            ))}
          </tr>

          {/* Typical Coursework */}
          <tr>
            <th
              scope="row"
              className="p-4 align-top border-r text-left font-medium text-muted-foreground"
            >
              Typical Coursework
            </th>
            {majors.map((major) => (
              <td key={major.id} className="p-4 align-top border-r last:border-r-0">
                {!major.typical_coursework?.length && <p className="text-muted-foreground">Coursework information not available</p>}
                <ul className="space-y-1.5">
                  {(major.typical_coursework ?? []).map((course) => (
                    <li key={course} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      {course}
                    </li>
                  ))}
                </ul>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
