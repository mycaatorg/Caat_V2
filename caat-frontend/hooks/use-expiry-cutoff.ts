import { useMemo, useSyncExternalStore } from "react";

// Browser timers overflow above ~24.8 days; shared links last 30 days.
const MAX_TIMER_DELAY = 2_147_483_647;
const serverSnapshot = () => Number.NEGATIVE_INFINITY;

function expiryStore(records: readonly { expires_at: string }[]) {
  const deadlines = [...new Set(records.map(row => Date.parse(row.expires_at)))]
    .filter(Number.isFinite).sort((a, b) => a - b);

  function getSnapshot() {
    const now = Date.now();
    let cutoff = Number.NEGATIVE_INFINITY;
    for (const deadline of deadlines) {
      if (deadline > now) break;
      cutoff = deadline;
    }
    return cutoff;
  }

  function subscribe(onChange: () => void) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function schedule() {
      clearTimeout(timer);
      const now = Date.now();
      const next = deadlines.find(deadline => deadline > now);
      if (next !== undefined) timer = setTimeout(refresh, Math.min(next - now, MAX_TIMER_DELAY));
    }
    function refresh() {
      onChange();
      schedule();
    }
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }

  return { subscribe, getSnapshot };
}

/** Display-only expiry: server-side sharing checks remain authoritative. */
export function useExpiryCutoff(records: readonly { expires_at: string }[]) {
  const store = useMemo(() => expiryStore(records), [records]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, serverSnapshot);
}
