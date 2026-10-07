import { useState } from "react";

/**
 * State seeded from a prop that the component may also confirm locally (after
 * a successful server action). A newer prop value replaces it, so pages that
 * refresh their props still show the latest server value, while feeds whose
 * props never change keep what the component confirmed.
 */
export function usePropBackedState<T>(prop: T, same: (a: T, b: T) => boolean = Object.is) {
  const [seen, setSeen] = useState(prop);
  const [value, setValue] = useState(prop);
  if (!same(seen, prop)) {
    // Adjusting state while rendering is React's pattern for prop changes.
    setSeen(prop);
    setValue(prop);
  }
  return [value, setValue] as const;
}
