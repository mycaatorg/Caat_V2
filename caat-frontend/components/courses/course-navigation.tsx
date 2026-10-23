import Link from 'next/link';

export function CourseNavigation({ current }: { current: 'majors' | 'courses' }) {
  return <nav aria-label="Course exploration" className="mb-6 flex flex-wrap gap-2 border-b pb-3 text-sm">
    {([['majors', 'Explore majors'], ['courses', 'University courses']] as const).map(([route, label]) =>
      <Link key={route} href={`/${route}`} aria-current={current === route ? 'page' : undefined}
        className={`rounded-md px-3 py-2 focus-visible:outline focus-visible:outline-2 ${current === route ? 'bg-[#9a1a27] text-white' : 'text-muted-foreground hover:bg-muted'}`}>{label}</Link>)}
  </nav>;
}
