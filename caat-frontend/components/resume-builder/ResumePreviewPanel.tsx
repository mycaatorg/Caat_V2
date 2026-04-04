"use client";

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ResumeSection } from "./types";

function safeText(x: unknown) {
  return typeof x === "string" ? x : "";
}

// True A4 dimensions at 96 CSS-dpi (210mm x 297mm)
export const PAGE_WIDTH_PX = 794;
export const PAGE_HEIGHT_PX = 1123;
export const PAGE_PADDING_PX = 68; // ~18mm margins

// All spacing constants scaled proportionally to the A4 width
export const FIRST_PAGE_GAP_PX = 60;
export const SECTION_GROUP_GAP_PX = 45;
export const SECTION_HEADER_MARGIN_PX = 23;
export const PAGE_BOTTOM_RESERVE_PX = 60;

// Font sizes tuned for A4 output (≈11pt body when printed)
export const NAME_FONT_PX = 45;
export const CONTACT_FONT_PX = 21;
export const SECTION_LABEL_FONT_PX = 21;
export const FOOTER_FONT_PX = 19;

type RenderBlock = {
  id: string;
  sectionId: string;
  sectionLabel: string;
  tagName: string;
  html: string;
  plainText: string;
  splittable: boolean;
};

export type PageSectionChunk = {
  sectionId: string;
  sectionLabel: string;
  includeSectionHeader: boolean;
  htmlBlocks: string[];
};

export type PageModel = {
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

/* Shared JSX for a single page — used by both the visible preview and the
   print portal so the two always render identical content. */
export function ResumePage({
  page,
  totalPages,
  personal,
  showFooter = true,
}: {
  page: PageModel;
  totalPages: number;
  personal: Record<string, unknown>;
  showFooter?: boolean;
}) {
  return (
    <div
      className="resume-page bg-white overflow-hidden flex flex-col"
      style={{
        width: PAGE_WIDTH_PX,
        height: PAGE_HEIGHT_PX,
        padding: PAGE_PADDING_PX,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {page.pageIndex === 0 && (
          <div style={{ textAlign: "center" }}>
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
              {"  \u2022  "}
              {safeText(personal.phone) || "+1 234 567 890"}
              {"  \u2022  "}
              {safeText(personal.location) || "Sydney, Australia"}
              {"  \u2022  "}
              <span style={{ color: "rgb(37 99 235)", textDecoration: "underline" }}>
                {safeText(personal.linkedin) || "linkedin.com/in/johndoe"}
              </span>
            </div>
          </div>
        )}

        <div style={page.pageIndex === 0 ? { marginTop: FIRST_PAGE_GAP_PX } : undefined}>
          {page.sections.map((section, sectionIndex) => (
            <div
              key={`${page.pageIndex}-${section.sectionId}-${sectionIndex}`}
              style={sectionIndex > 0 ? { marginTop: SECTION_GROUP_GAP_PX } : undefined}
            >
              {section.includeSectionHeader && (
                <div style={{ marginBottom: SECTION_HEADER_MARGIN_PX }}>
                  <div
                    style={{
                      fontSize: SECTION_LABEL_FONT_PX,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {section.sectionLabel.toUpperCase()}
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

      {showFooter && (
        <footer
          className="resume-page-footer"
          style={{
            flexShrink: 0,
            paddingTop: 8,
            textAlign: "center",
            fontSize: FOOTER_FONT_PX,
            color: "#888",
          }}
        >
          {page.pageIndex + 1} of {totalPages}
        </footer>
      )}
    </div>
  );
}

export default function ResumePreviewPanel({
  sections,
  onPagesComputed,
}: {
  sections: ResumeSection[];
  onPagesComputed?: (pages: PageModel[], personal: Record<string, unknown>) => void;
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
      const sectionBlocks = getTopLevelBlocks(section.id, section.label, section.contentHtml);
      if (sectionBlocks.length === 0) {
        // Empty section — push a zero-height sentinel so the section header
        // still appears in pagination without any visible placeholder text.
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

  const measurementRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<PageModel[]>([]);
  const [fontsReady, setFontsReady] = useState(false);
  const [displayScale, setDisplayScale] = useState(0.53);

  // Track available width in the preview panel so we can scale pages to fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) {
        setDisplayScale(Math.min(1, width / PAGE_WIDTH_PX));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFontsReady(true);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPages([]);
      return;
    }

    if (blocks.length === 0) {
      const empty: PageModel[] = [{ pageIndex: 0, sections: [] }];
      setPages(empty);
      onPagesComputed?.(empty, personal);
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

      const isSectionContinuation = sectionsWithHeader.has(block.sectionId);
      const needsSectionHeader =
        !isSectionContinuation &&
        (!lastSectionOnPage || lastSectionOnPage.sectionId !== block.sectionId);

      const isFirstSectionOnPage = currentPage.sections.length === 0;
      const headerCost = needsSectionHeader
        ? sectionHeaderHeight +
          SECTION_HEADER_MARGIN_PX +
          (!isFirstSectionOnPage ? SECTION_GROUP_GAP_PX : 0)
        : 0;
      const fullBlockHeight = measureHtml(block.html);
      const totalNeeded = headerCost + fullBlockHeight;

      if (totalNeeded <= remainingHeight) {
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

      const availableForBlock = remainingHeight - headerCost;

      if (availableForBlock > 0 && block.splittable) {
        const split = splitBlockToFit(block, availableForBlock);

        if (split.headHtml) {
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

      if (currentPage.sections.length > 0) {
        startNewPage();
        queue.unshift(block);
        continue;
      }

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
    onPagesComputed?.(resultPages, personal);
  }, [blocks, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="border-l bg-muted/30 p-4 overflow-auto">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>A4</div>
        <div>Professional Resume Style</div>
        <div>100%</div>
      </div>

      {/* Hidden measurement container — renders at true A4 width so that
          text wrapping matches the visible pages exactly. */}
      <div
        ref={measurementRef}
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
                {"  \u2022  "}
                {safeText(personal.phone) || "+1 234 567 890"}
                {"  \u2022  "}
                {safeText(personal.location) || "Sydney, Australia"}
                {"  \u2022  "}
                <span style={{ color: "rgb(37 99 235)", textDecoration: "underline" }}>
                  {safeText(personal.linkedin) || "linkedin.com/in/johndoe"}
                </span>
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

      {/* Visible preview — each page is rendered at true A4 size and CSS-scaled
          to fit the panel width. This guarantees text wrapping and page breaks
          in the preview match the printed output exactly. */}
      <div className="flex flex-col items-center gap-6">
        {pages.map((page) => (
          <div
            key={page.pageIndex}
            style={{
              width: PAGE_WIDTH_PX * displayScale,
              height: PAGE_HEIGHT_PX * displayScale,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                transform: `scale(${displayScale})`,
                transformOrigin: "top left",
              }}
            >
              <ResumePage
                page={page}
                totalPages={pages.length}
                personal={personal}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
