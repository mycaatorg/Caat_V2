# Mobile viewport external store (PROD-250, child PROD-248)

Execute inline. Replace the state/effect viewport mirror in useIsMobile with useSyncExternalStore. Client-only mounts read the current viewport immediately. SSR and hydration use the existing false fallback, then synchronize with the browser. Subscribe to the same media query used by getSnapshot, return listener cleanup, keep subscription functions stable and no module-time window access. Preserve the <768px contract, including fractional CSS pixels, with a range query (already supported by the Tailwind 4 browser baseline).

RED: a real React client mount currently first renders false on a phone even when the media query is mobile. Regression tests also cover desktop/phone resize, 768 boundary, fractional widths, rerender subscription stability, cleanup, server rendering without browser access and hydration without recoverable mismatch. GREEN: small hook-only runtime change; remove its PROD-248 exception. No sidebar redesign or storage/auth changes.

Run types/lint/whole-source coverage, production build, isolated desktop and Android/iPhone navigation, actual Claude and one fresh independent whole-branch review, hosted CI and separately verified production release. Do not alter release304 while it is being verified. Parent248 stays In Progress until other scoped exceptions are removed.
