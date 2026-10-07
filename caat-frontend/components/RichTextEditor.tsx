"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import React, { useEffect } from "react";
import { FontSizeExtension } from "@/extensions/FontSize";
import { LineHeightExtension } from "@/extensions/LineHeight";
import { IndentExtension, MAX_INDENT } from "@/extensions/Indent";
import { ListStyleExtension } from "@/extensions/ListStyle";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, Link2, Highlighter, Baseline, ChevronDown, Check, RemoveFormatting } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "Arial", label: "Arial" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Comic Sans MS", label: "Comic Sans" },
  { value: "Verdana", label: "Verdana" },
  { value: "Courier New", label: "Courier" },
];
const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const LINE_HEIGHTS: { value: string; label: string }[] = [
  { value: "", label: "Default" },
  { value: "1", label: "Single" },
  { value: "1.15", label: "1.15" },
  { value: "1.5", label: "1.5" },
  { value: "2", label: "Double" },
];
const BULLET_STYLES: { value: string; label: string }[] = [
  { value: "disc", label: "●  Disc" },
  { value: "circle", label: "○  Circle" },
  { value: "square", label: "▪  Square" },
];
const NUMBER_STYLES: { value: string; label: string }[] = [
  { value: "decimal", label: "1.  Number" },
  { value: "lower-alpha", label: "a.  Letter" },
  { value: "upper-alpha", label: "A.  Letter" },
  { value: "lower-roman", label: "i.  Roman" },
];
// `swatch` overrides the colour shown in the dropdown chip (used so "Default"
// reflects the real default text colour, black, instead of an empty square).
const TEXT_COLORS: { value: string | null; label: string; swatch?: string }[] = [
  { value: null, label: "Default", swatch: "#0a0a0a" },
  { value: "#9a1a27", label: "CAAT red" },
  { value: "#dc2626", label: "Red" },
  { value: "#0a0a0a", label: "Black" },
  { value: "#525252", label: "Grey" },
  { value: "#2563eb", label: "Blue" },
  { value: "#16a34a", label: "Green" },
];
const HIGHLIGHTS: { value: string | null; label: string }[] = [
  { value: null, label: "None" },
  { value: "#fef08a", label: "Yellow" },
  { value: "#bbf7d0", label: "Green" },
  { value: "#bfdbfe", label: "Blue" },
  { value: "#fbcfe8", label: "Pink" },
];

// Tooltip body: friendly name + a tiny (~3-word) plain-language hint.
const Tip = ({ label, hint }: { label: string; hint?: string }) => (
  <div className="text-center leading-tight">
    <div className="font-medium">{label}</div>
    {hint ? <div className="opacity-70">{hint}</div> : null}
  </div>
);

const ToolbarButton = ({
  onClick,
  isActive,
  children,
  label,
  hint,
}: {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  label: string;
  hint?: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={isActive}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition text-sm font-medium ${
          isActive ? "bg-[#9a1a27] text-white" : "bg-background text-foreground hover:bg-muted"
        }`}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom"><Tip label={label} hint={hint} /></TooltipContent>
  </Tooltip>
);

// Tooltip wrapper for the dropdown / select triggers (text controls).
const TriggerTip = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom"><Tip label={label} hint={hint} /></TooltipContent>
  </Tooltip>
);

// A control group: keeps related controls together so the toolbar wraps as
// whole groups instead of scattering individual buttons.
const Group = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-1">{children}</div>
);
const Divider = () => <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />;

interface RichTextEditorProps {
  content: string;
  onChange: (value: string) => void;
  // "minimal" trims the toolbar to the essentials (used for guided Notes fields,
  // where a full toolbar per entry card would be cluttered).
  variant?: "full" | "minimal";
}

export default function RichTextEditor({ content, onChange, variant = "full" }: RichTextEditorProps) {
  const minimal = variant === "minimal";
  const editor = useEditor({
    immediatelyRender: false,
    // The toolbar reads the selection (active marks, list controls); without
    // this it only refreshed on edits, not when the cursor moved.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyle,
      Color,
      BackgroundColor,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSizeExtension,
      LineHeightExtension,
      IndentExtension,
      ListStyleExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  // Snapshot the editor selection when a Radix popover opens (it moves focus
  // out of the editor, collapsing the visible selection), and restore it before
  // applying the change so marks land on the originally-selected text.
  const savedSelection = React.useRef<{ from: number; to: number } | null>(null);
  const snapshotSelection = (open: boolean) => {
    if (open && editor) {
      const { from, to } = editor.state.selection;
      savedSelection.current = { from, to };
    }
  };
  const withSavedSelection = () => {
    const chain = editor!.chain().focus();
    const sel = savedSelection.current;
    return sel ? chain.setTextSelection(sel) : chain;
  };

  // Link input (inline)
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkValue, setLinkValue] = React.useState("");
  const openLink = () => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    savedSelection.current = { from, to };
    setLinkValue(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const url = linkValue.trim();
    if (url) {
      withSavedSelection().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
    setLinkValue("");
  };

  if (!editor) {
    return (
      <div className="border rounded-md p-2 min-h-30 text-muted-foreground">Loading editor...</div>
    );
  }

  const currentHeading = editor.isActive("heading", { level: 1 })
    ? "1"
    : editor.isActive("heading", { level: 2 })
      ? "2"
      : editor.isActive("heading", { level: 3 })
        ? "3"
        : "normal";

  const currentLineHeight =
    editor.getAttributes("paragraph").lineHeight ||
    editor.getAttributes("heading").lineHeight ||
    "";
  const setLineHeight = (v: string) => {
    const lh = v || null;
    withSavedSelection()
      .updateAttributes("paragraph", { lineHeight: lh })
      .updateAttributes("heading", { lineHeight: lh })
      .run();
  };
  const currentIndent = () =>
    Number(editor.getAttributes("paragraph").indent ?? editor.getAttributes("heading").indent ?? 0);
  const changeIndent = (delta: number) => {
    const next = Math.max(0, Math.min(MAX_INDENT, currentIndent() + delta));
    editor
      .chain()
      .focus()
      .updateAttributes("paragraph", { indent: next })
      .updateAttributes("heading", { indent: next })
      .run();
  };
  const clearFormatting = () =>
    editor
      .chain()
      .focus()
      .unsetAllMarks()
      .clearNodes()
      .unsetTextAlign()
      .updateAttributes("paragraph", { lineHeight: null, indent: 0 })
      .run();

  const inBulletList = editor.isActive("bulletList");
  const inOrderedList = editor.isActive("orderedList");
  const inList = inBulletList || inOrderedList;
  const currentListStyle =
    (inOrderedList ? editor.getAttributes("orderedList").listStyleType : editor.getAttributes("bulletList").listStyleType) || "";
  const setListStyle = (val: string) => {
    const type = inOrderedList ? "orderedList" : "bulletList";
    withSavedSelection().updateAttributes(type, { listStyleType: val }).run();
  };

  return (
    <TooltipProvider delayDuration={250}>
      <div>
        {/* Toolbar */}
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex flex-wrap items-center gap-2 mb-3 bg-muted p-2 rounded-md"
        >
          {/* Format */}
          <Group>
            <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")}>
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")}>
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")}>
              <Underline className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")}>
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
          </Group>

          {!minimal && (
          <>
          <Divider />

          {/* Text style */}
          <Group>
            <Select
              value={currentHeading}
              onOpenChange={snapshotSelection}
              onValueChange={(v) =>
                v === "normal"
                  ? withSavedSelection().setParagraph().run()
                  : withSavedSelection().toggleHeading({ level: Number(v) as 1 | 2 | 3 }).run()
              }
            >
              <TriggerTip label="Text style">
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-sm" aria-label="Text style">
                  <SelectValue />
                </SelectTrigger>
              </TriggerTip>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="1">Heading 1</SelectItem>
                <SelectItem value="2">Heading 2</SelectItem>
                <SelectItem value="3">Heading 3</SelectItem>
              </SelectContent>
            </Select>
          </Group>
          </>
          )}

          <Divider />

          {/* Lists */}
          <Group>
            <ToolbarButton label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")}>
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")}>
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <DropdownMenu onOpenChange={snapshotSelection}>
              <TriggerTip label="List style" hint={inList ? undefined : "Select a list first"}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="List style" disabled={!inList}>
                    <ListChecks className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </TriggerTip>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                {(inOrderedList ? NUMBER_STYLES : BULLET_STYLES).map((s) => (
                  <DropdownMenuItem key={s.value} onSelect={() => setListStyle(s.value)}>
                    {s.label}
                    {currentListStyle === s.value ? (
                      <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Group>

          {!minimal && (
          <>
          <Divider />

          {/* Align */}
          <Group>
            <ToolbarButton label="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} isActive={editor.isActive({ textAlign: "left" })}>
              <AlignLeft className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} isActive={editor.isActive({ textAlign: "center" })}>
              <AlignCenter className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} isActive={editor.isActive({ textAlign: "right" })}>
              <AlignRight className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Justify" hint="Even both edges" onClick={() => editor.chain().focus().setTextAlign("justify").run()} isActive={editor.isActive({ textAlign: "justify" })}>
              <AlignJustify className="h-4 w-4" />
            </ToolbarButton>
          </Group>

          <Divider />

          {/* Indent */}
          <Group>
            <ToolbarButton label="Decrease indent" hint="Move left" onClick={() => changeIndent(-1)} isActive={false}>
              <IndentDecrease className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Increase indent" hint="Move right" onClick={() => changeIndent(1)} isActive={false}>
              <IndentIncrease className="h-4 w-4" />
            </ToolbarButton>
          </Group>

          <Divider />

          {/* Type */}
          <Group>
            <Select
              value={editor.getAttributes("textStyle").fontFamily || "__default"}
              onOpenChange={snapshotSelection}
              onValueChange={(v) =>
                v === "__default"
                  ? withSavedSelection().unsetFontFamily().run()
                  : withSavedSelection().setFontFamily(v).run()
              }
            >
              <TriggerTip label="Font">
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-sm" aria-label="Font family">
                  <SelectValue />
                </SelectTrigger>
              </TriggerTip>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <SelectItem value="__default">Default</SelectItem>
                {FONT_FAMILIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={editor.getAttributes("textStyle").fontSize || "__default"}
              onOpenChange={snapshotSelection}
              onValueChange={(v) =>
                withSavedSelection().setMark("textStyle", { fontSize: v === "__default" ? null : v }).run()
              }
            >
              <TriggerTip label="Font size">
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-sm" aria-label="Font size">
                  <SelectValue />
                </SelectTrigger>
              </TriggerTip>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <SelectItem value="__default">Default</SelectItem>
                {FONT_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("px", "")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={currentLineHeight || "__default"}
              onOpenChange={snapshotSelection}
              onValueChange={(v) => setLineHeight(v === "__default" ? "" : v)}
            >
              <TriggerTip label="Line spacing">
                <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-sm" aria-label="Line spacing">
                  <SelectValue placeholder="Spacing" />
                </SelectTrigger>
              </TriggerTip>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                {LINE_HEIGHTS.map((lh) => (
                  <SelectItem key={lh.label} value={lh.value || "__default"}>{lh.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Group>

          <Divider />

          {/* Colour */}
          <Group>
            <DropdownMenu onOpenChange={snapshotSelection}>
              <TriggerTip label="Text colour">
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="Text colour">
                    <Baseline className="h-4 w-4" style={{ color: editor.getAttributes("textStyle").color || undefined }} />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </TriggerTip>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                {TEXT_COLORS.map((c) => (
                  <DropdownMenuItem
                    key={c.label}
                    onSelect={() =>
                      c.value
                        ? withSavedSelection().setColor(c.value).run()
                        : withSavedSelection().unsetColor().run()
                    }
                  >
                    <span className="h-3.5 w-3.5 rounded-sm border" style={{ background: c.swatch ?? c.value ?? "transparent" }} />
                    {c.label}
                    {(editor.getAttributes("textStyle").color || null) === c.value ? (
                      <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu onOpenChange={snapshotSelection}>
              <TriggerTip label="Highlight">
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5" aria-label="Highlight">
                    <Highlighter className="h-4 w-4" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </TriggerTip>
              <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
                {HIGHLIGHTS.map((h) => (
                  <DropdownMenuItem
                    key={h.label}
                    onSelect={() =>
                      h.value
                        ? withSavedSelection().setBackgroundColor(h.value).run()
                        : withSavedSelection().unsetBackgroundColor().run()
                    }
                  >
                    <span className="h-3.5 w-3.5 rounded-sm border" style={{ background: h.value ?? "transparent" }} />
                    {h.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Group>
          </>
          )}

          <Divider />

          {/* Insert + reset */}
          <Group>
            <ToolbarButton label="Link" onClick={openLink} isActive={editor.isActive("link")}>
              <Link2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton label="Clear formatting" hint="Remove styling" onClick={clearFormatting} isActive={false}>
              <RemoveFormatting className="h-4 w-4" />
            </ToolbarButton>
          </Group>
        </div>

        {/* Inline link input */}
        {linkOpen && (
          <div className="flex items-center gap-2 mb-3">
            <Input
              autoFocus
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === "Escape") {
                  setLinkOpen(false);
                  setLinkValue("");
                }
              }}
              placeholder="https://example.com"
              className="h-8 text-sm max-w-xs"
              aria-label="Link URL"
            />
            <Button size="sm" className="h-8" onClick={applyLink}>Apply</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setLinkOpen(false); setLinkValue(""); }}>
              Cancel
            </Button>
          </div>
        )}

        {/* Editor area */}
        <div className="border rounded-md p-2 min-h-30 bg-background text-foreground focus-within:ring-1 focus-within:ring-ring">
          <EditorContent editor={editor} />
        </div>
      </div>
    </TooltipProvider>
  );
}
