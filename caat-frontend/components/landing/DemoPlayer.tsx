"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

const YT_VIDEO_ID = "ESIc6o3kMpk";
const THUMB_SRC = `https://i.ytimg.com/vi/${YT_VIDEO_ID}/maxresdefault.jpg`;

export function DemoPlayer() {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (activated) return;
    const activate = () => setActivated(true);
    const onHash = () => {
      if (window.location.hash === "#demo") activate();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href="#demo"]');
      if (a) activate();
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    if (window.location.hash === "#demo") activate();
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, [activated]);

  if (activated) {
    return (
      <div className="aspect-video w-full">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${YT_VIDEO_ID}?rel=0&modestbranding=1&autoplay=1&playsinline=1`}
          title="CAAT Product Demo"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label="Play CAAT product demo"
      className="group relative aspect-video w-full overflow-hidden bg-black focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[3px]"
    >
      <Image
        src={THUMB_SRC}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-20 w-20 items-center justify-center bg-[#9a1a27] text-white shadow-[6px_6px_0_0_rgba(0,0,0,0.85)] transition-transform group-hover:scale-110">
          <Play size={32} strokeWidth={2} fill="currentColor" />
        </span>
      </span>
    </button>
  );
}
