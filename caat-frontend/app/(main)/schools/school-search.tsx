"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SchoolSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(defaultValue);
  
  // Track the last searched value to prevent redundant router pushes
  const lastSearched = useRef(defaultValue);

  useEffect(() => {
    // Only run the timeout if the text has actually changed
    if (query === lastSearched.current) return;

    const timeoutId = setTimeout(() => {
      lastSearched.current = query;
      const params = new URLSearchParams(searchParams.toString());
      
      if (query.trim()) {
        params.set("q", query.trim());
        params.set("page", "1"); // Reset pagination on new search
      } else {
        params.delete("q");
      }

      router.replace(`${pathname}?${params.toString()}`);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, pathname, router, searchParams]);

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        className="pl-9"
        placeholder="Search schools..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}