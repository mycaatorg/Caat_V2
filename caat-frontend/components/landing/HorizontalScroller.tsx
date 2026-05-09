"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps a horizontally-scrollable region and converts mouse-wheel vertical
 * scroll into horizontal scroll while the cursor is over the container.
 *
 * Page scroll is preserved at the boundaries: when the user has reached the
 * left or right edge and keeps scrolling in that direction, the page resumes
 * scrolling normally instead of trapping the user inside the carousel.
 *
 * Trackpad horizontal swipes (deltaX) and existing horizontal intent are
 * passed through untouched so we don't fight native gestures.
 */
export function HorizontalScroller({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      // If the user is already scrolling horizontally (trackpad swipe), let
      // the browser handle it natively.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (e.deltaY === 0) return;

      const target = e.currentTarget as HTMLDivElement;
      const atStart = target.scrollLeft <= 0;
      const atEnd =
        target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;

      // Boundary release: if the user is already at an edge and scrolling
      // further past it, let the page scroll vertically as normal.
      if ((atStart && e.deltaY < 0) || (atEnd && e.deltaY > 0)) return;

      e.preventDefault();
      target.scrollLeft += e.deltaY;
    }

    // Must be non-passive so preventDefault works.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
