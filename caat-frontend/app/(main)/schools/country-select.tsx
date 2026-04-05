"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COUNTRIES = [
  "United States",
  "Australia",
  "Canada",
  "Singapore",
  "United Kingdom",
];

export default function CountrySelect({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleValueChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "__all__") {
      params.delete("country");
    } else {
      params.set("country", value);
    }
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="w-full md:w-[200px]">
      <Select defaultValue={defaultValue || "__all__"} onValueChange={handleValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Countries</SelectItem>
          {COUNTRIES.map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
