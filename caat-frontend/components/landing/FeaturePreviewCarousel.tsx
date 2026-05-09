"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ImageOff } from "lucide-react";
import { HorizontalScroller } from "./HorizontalScroller";

export interface FeaturePreview {
  title: string;
  description: string;
  /**
   * Public path to the in-app screenshot for this feature, e.g.
   * "/feature-previews/application-tracker.png". Leave undefined to show
   * a "preview coming soon" placeholder.
   */
  previewImage?: string;
}

interface Props {
  features: {
    title: string;
    description: string;
    icon: React.ReactNode;
    previewImage?: string;
    /** When true, this card renders as a static (non-clickable) tile. */
    disablePreview?: boolean;
  }[];
}

export function FeaturePreviewCarousel({ features }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex !== null ? features[openIndex] : null;

  // Close on Escape.
  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIndex]);

  return (
    <>
      <HorizontalScroller className="border border-black overflow-x-auto">
        <div className="flex min-w-max">
          {features.map((feature, i) => {
            const cardClasses = `group w-72 flex-none p-8 text-left transition-colors duration-100 hover:bg-black hover:text-white ${
              i < features.length - 1 ? "border-r border-black" : ""
            }`;

            const inner = (
              <>
                <div className="mb-6 group-hover:text-white transition-colors duration-100">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4 font-display">
                  {feature.title}
                </h3>
                <p className="text-[#525252] group-hover:text-[#BFBFBF] leading-relaxed transition-colors duration-100 font-serif text-sm">
                  {feature.description}
                </p>
                {!feature.disablePreview && (
                  <span className="mt-5 inline-block text-[10px] font-code tracking-[0.18em] uppercase text-[#525252] group-hover:text-white transition-colors">
                    Preview →
                  </span>
                )}
              </>
            );

            if (feature.disablePreview) {
              return (
                <div
                  key={feature.title}
                  className={`${cardClasses} cursor-default`}
                >
                  {inner}
                </div>
              );
            }

            return (
              <button
                key={feature.title}
                type="button"
                onClick={() => setOpenIndex(i)}
                className={`${cardClasses} focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-[-3px]`}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </HorizontalScroller>

      {open && (
        <FeaturePreviewModal
          title={open.title}
          description={open.description}
          previewImage={open.previewImage}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}

function FeaturePreviewModal({
  title,
  description,
  previewImage,
  onClose,
}: {
  title: string;
  description: string;
  previewImage?: string;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Close when clicking the backdrop (anywhere outside the card).
  function onBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      onMouseDown={onBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm font-serif"
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-4xl border-2 border-black bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="absolute top-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center bg-white border border-black text-black hover:bg-black hover:text-white transition-colors focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#9a1a27] focus-visible:outline-offset-2"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        {/* Title bar */}
        <div className="border-b-2 border-black px-6 py-4">
          <p className="text-[10px] font-code tracking-[0.18em] uppercase text-[#525252] mb-1">
            Feature preview
          </p>
          <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">
            {title}
          </h2>
        </div>

        {/* Screenshot. Uses object-contain so the full screenshot is visible
            (no awkward cropping), and a white background so any whitespace
            inside the screenshot blends seamlessly with the modal frame. */}
        <div className="relative aspect-[16/9] w-full bg-white border-b-2 border-black overflow-hidden">
          {previewImage ? (
            <Image
              src={previewImage}
              alt={`${title} screenshot`}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-contain object-center"
            />
          ) : (
            <PreviewPlaceholder title={title} />
          )}
        </div>

        {/* Description */}
        <div className="px-6 py-5">
          <p className="text-sm md:text-base text-[#333] leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
      <ImageOff size={28} strokeWidth={1.25} className="text-[#888]" />
      <p className="text-sm font-medium text-[#525252]">
        Screenshot for {title} not added yet.
      </p>
      <p className="text-[11px] font-code tracking-[0.1em] uppercase text-[#888] max-w-md">
        Drop the image at{" "}
        <span className="text-black">
          /public/feature-previews/{slugify(title)}.png
        </span>{" "}
        and reload.
      </p>
    </div>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
