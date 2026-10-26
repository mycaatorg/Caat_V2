"use client";
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode, type RefObject } from 'react';
export function LibraryDialog({ title, description, busy, onClose, children, returnFocusRef, fallbackFocusRef }: { title: string; description: string; busy: boolean; onClose: () => void; children: ReactNode; returnFocusRef?: RefObject<HTMLElement | null>; fallbackFocusRef?: RefObject<HTMLElement | null> }) {
  const opener = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement);
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content onCloseAutoFocus={e => { e.preventDefault(); const target = returnFocusRef?.current ?? opener.current; if (target?.isConnected) target.focus(); if (document.activeElement !== target) fallbackFocusRef?.current?.focus(); }} className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-background p-5 shadow-lg" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
        <div className="flex items-start justify-between gap-3">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Close disabled={busy} aria-label="Close dialog" className="rounded p-1 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"><X className="h-5 w-5" /></Dialog.Close>
        </div>
        <Dialog.Description className="mt-2 text-sm text-muted-foreground">{description}</Dialog.Description>
        <div className="mt-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
