"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ResumeSection } from "./types";
import {
  ResumePage,
  PAGE_WIDTH_PX,
  PAGE_HEIGHT_PX,
  PAGE_PADDING_PX,
  FIRST_PAGE_GAP_PX,
  SECTION_GROUP_GAP_PX,
  SECTION_HEADER_MARGIN_PX,
  PAGE_BOTTOM_RESERVE_PX,
  NAME_FONT_PX,
  CONTACT_FONT_PX,
  SECTION_LABEL_FONT_PX,
} from "./ResumePreviewPanel";
import type { PageModel, PageSectionChunk } from "./ResumePreviewPanel";

function safeText(x: unknown) {
  return typeof x === "string" ? x : "";
}

type RenderBlock = {
  id: string;
  sectionId: string;
  sectionLabel: string;
  tagName: string;
  html: string;
  plainText: string;
  splittable: boolean;
};

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTopLevelBlocks(
  sectionId: string,
  sectionLabel: string,
  html: string
): RenderBlock[] {
  if (typeof document === "undefined") return [];

  const container = document.createElement("div");
  container.innerHTML = html || "";

  const nodes = Array.from(container.childNodes);
  const blocks: RenderBlock[] = [];

  nodes.forEach((node, index) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() ?? "";
      if (!text) return;
      blocks.push({
        id: `${sectionId}-text-${index}`,
        sectionId,
        sectionLabel,
        tagName: "p",
        html: `<p>${escapeHtml(text)}</p>`,
        plainText: text,
        splittable: false,
      });
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();

    if (tagName === "ul" || tagName === "ol") {
      const items = Array.from(el.children).filter(
        (child) => child.tagName.toLowerCase() === "li"
      ) as HTMLElement[];
      if (items.length === 0) {
        blocks.push({
          id: `${sectionId}-list-${index}`,
          sectionId,
          sectionLabel,
          tagName,
          html: el.outerHTML,
          plainText: el.textContent?.trim() ?? "",
          splittable: false,
        });
        return;
      }
      items.forEach((li, liIndex) => {
        const wrapper = document.createElement(tagName);
        wrapper.appendChild(li.cloneNode(true));
        blocks.push({
          id: `${sectionId}-li-${index}-${liIndex}`,
          sectionId,
          sectionLabel,
          tagName: "li",
          html: wrapper.outerHTML,
          plainText: li.textContent?.trim() ?? "",
          splittable: false,
        });
      });
      return;
    }

    blocks.push({
      id: `${sectionId}-block-${index}`,
      sectionId,
      sectionLabel,
      tagName,
      html: el.outerHTML,
      plainText: el.textContent?.trim() ?? "",
      splittable: false,
    });
  });

  return blocks;
}

/**
 * A read-only mini resume preview that shows page 1 scaled down to fit
 * a card. Reuses the same ResumePage component so rendering is identical.
 */
export function ResumePreviewMini({ sections }: { sections: ResumeSection[] }) {
  const personal =
    sections.find((s) => s.type === "personal")?.structuredData ?? {};

  const contentSections = useMemo(
    () => sections.filter((s) => s.type !== "personal"),
    [sections]
  );

  const blocks = useMemo(() => {
    if (typeof document === "undefined") return [] as RenderBlock[];
    const result: RenderBlock[] = [];
    contentSections.forEach((section) => {
      const sectionBlocks = getTopLevelBlocks(
        section.id,
        section.label,
        section.contentHtml
      );
      if (sectionBlocks.length === 0) {
        result.push({
          id: `${section.id}-empty`,
          sectionId: section.id,
          sectionLabel: section.label,
          tagName: "div",
          html: "<div></div>",
          plainText: "",
          splittable: false,
        });
      } else {
        result.push(...sectionBlocks);
      }
    });
    return result;
  }, [contentSections]);

  const measureRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<PageModel | null>(null);

  useLayoutEffect(() => {
    if (!measureRef.current || blocks.length === 0) {
      setPage({ pageIndex: 0, sections: [] });
      return;
    }

    const root = measureRef.current;
    const pageBody = root.querySelector<HTMLElement>("[data-measure-page-body]");
    const firstPageHeader = root.querySelector<HTMLElement>(
      "[data-measure-personal-header]"
    );
    const sectionHeaderMap: Record<string, number> = {};
    root
      .querySelectorAll<HTMLElement>("[data-measure-section-header]")
      .forEach((el) => {
        const sid = el.dataset.sectionId;
        if (sid) sectionHeaderMap[sid] = el.offsetHeight;
      });

    if (!pageBody) return;

    const pageBodyHeight =
      PAGE_HEIGHT_PX - PAGE_PADDING_PX * 2 - PAGE_BOTTOM_RESERVE_PX;
    const firstHeaderHeight = firstPageHeader?.offsetHeight ?? 0;
    const firstPageAvailable =
      pageBodyHeight - firstHeaderHeight - FIRST_PAGE_GAP_PX;

    function measureHtml(html: string) {
      if (!pageBody) return 0;
      const node = document.createElement("div");
      node.className = "resume-preview-content";
      node.style.width = "100%";
      node.innerHTML = html;
      pageBody.appendChild(node);
      const h = node.offsetHeight;
      pageBody.removeChild(node);
      return h;
    }

    // Build only page 0
    let remaining = firstPageAvailable;
    const pageSections: PageSectionChunk[] = [];
    const placed = new Set<string>();

    for (const block of blocks) {
      const headerH = sectionHeaderMap[block.sectionId] ?? 0;
      const last = pageSections[pageSections.length - 1];
      const needsHeader =
        !placed.has(block.sectionId) &&
        (!last || last.sectionId !== block.sectionId);
      const isFirst = pageSections.length === 0;
      const headerCost = needsHeader
        ? headerH + SECTION_HEADER_MARGIN_PX + (!isFirst ? SECTION_GROUP_GAP_PX : 0)
        : 0;
      const blockH = measureHtml(block.html);
      const total = headerCost + blockH;

      if (total > remaining) break;

      if (last && last.sectionId === block.sectionId) {
        last.htmlBlocks.push(block.html);
      } else {
        pageSections.push({
          sectionId: block.sectionId,
          sectionLabel: block.sectionLabel,
          includeSectionHeader: needsHeader,
          htmlBlocks: [block.html],
        });
      }
      if (needsHeader) placed.add(block.sectionId);
      remaining -= total;
    }

    setPage({ pageIndex: 0, sections: pageSections });
  }, [blocks]);

  // Scale factor to fit inside the card (~340px target width)
  const targetWidth = 340;
  const scale = targetWidth / PAGE_WIDTH_PX;

  return (
    <>
      {/* Hidden measurer at full A4 size */}
      <div
        ref={measureRef}
        className="pointer-events-none fixed -left-[9999px] -top-[9999px]"
      >
        <div
          className="bg-white"
          style={{
            width: PAGE_WIDTH_PX,
            height: PAGE_HEIGHT_PX,
            padding: PAGE_PADDING_PX,
            boxSizing: "border-box",
          }}
        >
          <div data-measure-page-body className="h-full overflow-hidden">
            <div data-measure-personal-header style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: NAME_FONT_PX,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  lineHeight: 1.2,
                }}
              >
                {safeText(personal.fullName) || "JOHN DOE"}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: CONTACT_FONT_PX,
                  color: "#666",
                  lineHeight: 1.4,
                }}
              >
                {safeText(personal.email) || "john@example.com"}
              </div>
            </div>
            <div style={{ marginTop: FIRST_PAGE_GAP_PX }}>
              {contentSections.map((section) => (
                <div key={section.id}>
                  <div
                    data-measure-section-header
                    data-section-id={section.id}
                    style={{ marginBottom: SECTION_HEADER_MARGIN_PX }}
                  >
                    <div
                      style={{
                        fontSize: SECTION_LABEL_FONT_PX,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                      }}
                    >
                      {section.label.toUpperCase()}
                    </div>
                    <hr
                      style={{
                        marginTop: 4,
                        border: "none",
                        borderTop: "2px solid #000",
                        width: "100%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scaled-down first page */}
      {page && (
        <div
          className="mx-auto"
          style={{
            width: PAGE_WIDTH_PX * scale,
            height: PAGE_HEIGHT_PX * scale,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <ResumePage
              page={page}
              totalPages={1}
              personal={personal}
              showFooter={false}
            />
          </div>
        </div>
      )}
    </>
  );
}
