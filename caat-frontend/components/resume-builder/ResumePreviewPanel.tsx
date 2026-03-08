"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ResumeSection } from "./types";

function safeText(x: any) {
  return typeof x === "string" ? x : "";
}

const PAGE_WIDTH_PX = 420;
const PAGE_HEIGHT_PX = PAGE_WIDTH_PX * Math.SQRT2;
const PAGE_PADDING_PX = 40; // p-10
const FIRST_PAGE_GAP_PX = 32; // mt-8
const SECTION_GROUP_GAP_PX = 24; // mt-6 between sections
const SECTION_HEADER_MARGIN_PX = 12; // mb-3 on section header (not captured by offsetHeight)
const PAGE_BOTTOM_RESERVE_PX = 32; // whitespace reserved at bottom of each page (Word-like gap)

type RenderBlock = {
  id: string;
  sectionId: string;
  sectionLabel: string;
  tagName: string;
  html: string;
  plainText: string;
  splittable: boolean;
};

type PageSectionChunk = {
  sectionId: string;
  sectionLabel: string;
  includeSectionHeader: boolean;
  htmlBlocks: string[];
};

type PageModel = {
  pageIndex: number;
  sections: PageSectionChunk[];
};

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
        splittable: true,
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
          splittable: true,
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
      splittable: tagName === "p" || tagName === "div" || tagName === "li",
    });
  });

  if (blocks.length === 0) {
    blocks.push({
      id: `${sectionId}-placeholder`,
      sectionId,
      sectionLabel,
      tagName: "p",
      html: "<p class='text-muted-foreground'>...</p>",
      plainText: "...",
      splittable: false,
    });
  }

  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeSplitHtml(tagName: string, text: string, originalHtml: string) {
  const safe = escapeHtml(text);

  if (tagName === "li") {
    return `<ul><li>${safe}</li></ul>`;
  }

  if (tagName === "div") {
    return `<div>${safe}</div>`;
  }

  if (tagName === "p") {
    return `<p>${safe}</p>`;
  }

  return originalHtml;
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export default function ResumePreviewPanel({
  sections,
}: {
  sections: ResumeSection[];
}) {
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
      result.push(
        ...getTopLevelBlocks(section.id, section.label, section.contentHtml)
      );
    });
    return result;
  }, [contentSections]);

  const measurementRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<PageModel[]>([]);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") {
      setFontsReady(true);
      return;
    }

    const anyDoc = document as any;
    if (anyDoc.fonts?.ready) {
      anyDoc.fonts.ready
        .then(() => setFontsReady(true))
        .catch(() => setFontsReady(true));
    } else {
      setFontsReady(true);
    }
  }, []);

  useLayoutEffect(() => {
    if (!fontsReady || !measurementRef.current) {
      setPages([]);
      return;
    }

    if (blocks.length === 0) {
      setPages([
        {
          pageIndex: 0,
          sections: [],
        },
      ]);
      return;
    }

    const root = measurementRef.current;
    const pageBody = root.querySelector<HTMLElement>("[data-measure-page-body]");
    const firstPageHeader = root.querySelector<HTMLElement>(
      "[data-measure-personal-header]"
    );
    const sectionHeaderMap: Record<string, number> = {};

    root
      .querySelectorAll<HTMLElement>("[data-measure-section-header]")
      .forEach((el) => {
        const sectionId = el.dataset.sectionId;
        if (!sectionId) return;
        sectionHeaderMap[sectionId] = el.offsetHeight;
      });

    if (!pageBody) return;

    const pageBodyHeight =
      PAGE_HEIGHT_PX - PAGE_PADDING_PX * 2 - PAGE_BOTTOM_RESERVE_PX;

    const firstHeaderHeight = firstPageHeader?.offsetHeight ?? 0;
    const firstPageAvailable =
      pageBodyHeight - firstHeaderHeight - FIRST_PAGE_GAP_PX;

    function createMeasureNode(html: string) {
      const wrapper = document.createElement("div");
      wrapper.className = "resume-preview-content";
      wrapper.style.width = "100%";
      wrapper.innerHTML = html;
      return wrapper;
    }

    function measureHtml(html: string) {
      if (!pageBody) return 0;
      const node = createMeasureNode(html);
      pageBody.appendChild(node);
      const height = node.offsetHeight;
      pageBody.removeChild(node);
      return height;
    }

    function splitBlockToFit(
      block: RenderBlock,
      availableHeight: number
    ): { headHtml: string | null; tailBlock: RenderBlock | null } {
      if (!block.splittable) {
        return { headHtml: null, tailBlock: block };
      }

      const allWords = words(block.plainText);
      if (allWords.length <= 1) {
        return { headHtml: null, tailBlock: block };
      }

      let low = 1;
      let high = allWords.length;
      let best = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidateText = allWords.slice(0, mid).join(" ");
        const candidateHtml = makeSplitHtml(
          block.tagName,
          candidateText,
          block.html
        );
        const candidateHeight = measureHtml(candidateHtml);

        if (candidateHeight <= availableHeight) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (best === 0) {
        return { headHtml: null, tailBlock: block };
      }

      const headText = allWords.slice(0, best).join(" ");
      const tailWords = allWords.slice(best);

      const headHtml = makeSplitHtml(block.tagName, headText, block.html);

      if (tailWords.length === 0) {
        return { headHtml, tailBlock: null };
      }

      const tailText = tailWords.join(" ");
      const tailHtml = makeSplitHtml(block.tagName, tailText, block.html);

      return {
        headHtml,
        tailBlock: {
          ...block,
          id: `${block.id}-cont-${best}`,
          html: tailHtml,
          plainText: tailText,
          splittable: tailWords.length > 1,
        },
      };
    }

    const resultPages: PageModel[] = [];
    let currentPageIndex = 0;
    let remainingHeight = firstPageAvailable;
    let currentPage: PageModel = { pageIndex: 0, sections: [] };
    // Tracks which sections have had their header placed on any page already.
    // Continuation chunks on subsequent pages must NOT repeat the header.
    const sectionsWithHeader = new Set<string>();

    function pushCurrentPage() {
      resultPages.push(currentPage);
    }

    function startNewPage() {
      pushCurrentPage();
      currentPageIndex += 1;
      currentPage = { pageIndex: currentPageIndex, sections: [] };
      remainingHeight = pageBodyHeight;
    }

    function getOrCreatePageSectionChunk(
      sectionId: string,
      sectionLabel: string,
      includeSectionHeader: boolean
    ) {
      const last = currentPage.sections[currentPage.sections.length - 1];

      if (last && last.sectionId === sectionId) {
        return last;
      }

      const next: PageSectionChunk = {
        sectionId,
        sectionLabel,
        includeSectionHeader,
        htmlBlocks: [],
      };

      currentPage.sections.push(next);
      return next;
    }

    const queue = [...blocks];

    while (queue.length > 0) {
      const block = queue.shift()!;
      const sectionHeaderHeight = sectionHeaderMap[block.sectionId] ?? 0;

      const lastSectionOnPage =
        currentPage.sections[currentPage.sections.length - 1];

      // Show the section header only when this section is starting on this page AND
      // it hasn't had its header placed on any previous page (i.e. not a continuation).
      const isSectionContinuation = sectionsWithHeader.has(block.sectionId);
      const needsSectionHeader =
        !isSectionContinuation &&
        (!lastSectionOnPage || lastSectionOnPage.sectionId !== block.sectionId);

      // headerCost = header element height + mb-3 margin + mt-6 gap before non-first sections
      const isFirstSectionOnPage = currentPage.sections.length === 0;
      const headerCost = needsSectionHeader
        ? sectionHeaderHeight +
          SECTION_HEADER_MARGIN_PX +
          (!isFirstSectionOnPage ? SECTION_GROUP_GAP_PX : 0)
        : 0;
      const fullBlockHeight = measureHtml(block.html);
      const totalNeeded = headerCost + fullBlockHeight;

      if (totalNeeded <= remainingHeight) {
        // Block fits entirely on this page.
        const chunk = getOrCreatePageSectionChunk(
          block.sectionId,
          block.sectionLabel,
          needsSectionHeader
        );
        chunk.htmlBlocks.push(block.html);
        remainingHeight -= totalNeeded;
        if (needsSectionHeader) sectionsWithHeader.add(block.sectionId);
        continue;
      }

      // Block doesn't fit entirely. Try to split it across this page and the next.
      // availableForBlock is the space left after the header (if any).
      const availableForBlock = remainingHeight - headerCost;

      if (availableForBlock > 0 && block.splittable) {
        const split = splitBlockToFit(block, availableForBlock);

        if (split.headHtml) {
          // Part of the block fits — place the head on this page.
          const chunk = getOrCreatePageSectionChunk(
            block.sectionId,
            block.sectionLabel,
            needsSectionHeader
          );
          chunk.htmlBlocks.push(split.headHtml);
          if (needsSectionHeader) sectionsWithHeader.add(block.sectionId);

          const placedHeight = headerCost + measureHtml(split.headHtml);
          remainingHeight = Math.max(0, remainingHeight - placedHeight);

          startNewPage();
          if (split.tailBlock) queue.unshift(split.tailBlock);
          continue;
        }
      }

      // Can't split (non-splittable block, or no words fit in remaining space).
      // If the page already has content, move to a fresh page and retry.
      // If the page is empty (block is just too tall), force-place it to avoid an infinite loop.
      if (currentPage.sections.length > 0) {
        startNewPage();
        queue.unshift(block);
        continue;
      }

      // Force-place on empty page.
      const chunk = getOrCreatePageSectionChunk(
        block.sectionId,
        block.sectionLabel,
        needsSectionHeader
      );
      chunk.htmlBlocks.push(block.html);
      if (needsSectionHeader) sectionsWithHeader.add(block.sectionId);
      remainingHeight = 0;

      if (queue.length > 0) {
        startNewPage();
      }
    }

    pushCurrentPage();
    setPages(resultPages);
  }, [blocks, fontsReady]);

  return (
    <div className="border-l bg-muted/30 p-4 overflow-auto">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>A4</div>
        <div>Professional Resume Style</div>
        <div>100%</div>
      </div>

      {/* hidden measurer */}
      <div
        ref={measurementRef}
        className="pointer-events-none fixed -left-[9999px] -top-[9999px]"
      >
        <div
          className="bg-white border p-10"
          style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX }}
        >
          <div data-measure-page-body className="h-full overflow-hidden">
            <div data-measure-personal-header className="text-center">
              <div className="text-2xl font-bold tracking-wide">
                {safeText(personal.fullName) || "JOHN DOE"}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {safeText(personal.email) || "john@example.com"}
                {"  •  "}
                {safeText(personal.phone) || "+1 234 567 890"}
                {"  •  "}
                {safeText(personal.location) || "Sydney, Australia"}
                {"  •  "}
                <span className="text-blue-600 underline">
                  {safeText(personal.linkedin) || "linkedin.com/in/johndoe"}
                </span>
              </div>
            </div>

            <div className="mt-8">
              {contentSections.map((section) => (
                <div key={section.id}>
                  <div
                    data-measure-section-header
                    data-section-id={section.id}
                    className="mb-3"
                  >
                    <div className="text-[11px] font-bold tracking-wider">
                      {section.label.toUpperCase()}
                    </div>
                    <div className="mt-1 h-px w-full bg-black/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6">
        {pages.map((page) => (
          <div
            key={page.pageIndex}
            className="mx-auto bg-white shadow-sm border p-10 overflow-hidden flex flex-col"
            style={{ width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX }}
          >
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {page.pageIndex === 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold tracking-wide">
                  {safeText(personal.fullName) || "JOHN DOE"}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {safeText(personal.email) || "john@example.com"}
                  {"  •  "}
                  {safeText(personal.phone) || "+1 234 567 890"}
                  {"  •  "}
                  {safeText(personal.location) || "Sydney, Australia"}
                  {"  •  "}
                  <span className="text-blue-600 underline">
                    {safeText(personal.linkedin) || "linkedin.com/in/johndoe"}
                  </span>
                </div>
              </div>
            )}

            <div className={page.pageIndex === 0 ? "mt-8" : ""}>
              {page.sections.map((section, sectionIndex) => (
                <div
                  key={`${page.pageIndex}-${section.sectionId}-${sectionIndex}`}
                  className={sectionIndex > 0 ? "mt-6" : ""}
                >
                  {section.includeSectionHeader && (
                    <div className="mb-3">
                      <div className="text-[11px] font-bold tracking-wider">
                        {section.sectionLabel.toUpperCase()}
                      </div>
                      <div className="mt-1 h-px w-full bg-black/40" />
                    </div>
                  )}

                  {section.htmlBlocks.map((html, i) => (
                    <div
                      key={i}
                      className="resume-preview-content"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ))}
                </div>
              ))}
            </div>
            </div>

            <footer className="flex-shrink-0 pt-2 text-center text-[10px] text-muted-foreground">
              {page.pageIndex + 1} of {pages.length}
            </footer>
          </div>
        ))}
      </div>
    </div>
  );
}