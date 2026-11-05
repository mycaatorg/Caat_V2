'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import type { ScholarshipRow } from '@/types/scholarships';
import ScholarshipComparison from './scholarship-comparison';

export function ScholarshipComparisonPanel({ selected, onRemove, onClear }: { selected: ScholarshipRow[]; onRemove: (id: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => new Date(0));
  if (open && selected.length < 2) setOpen(false);
  return <section aria-label="Scholarship comparison selection" className="mb-6 rounded-lg border bg-muted/20 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm font-medium" aria-live="polite">{selected.length} of 3 scholarships selected</p>
      <Dialog.Root open={open && selected.length >= 2} onOpenChange={next => { if (next) setNow(new Date()); setOpen(next); }}>
        <Dialog.Trigger asChild><Button variant="outline" disabled={selected.length < 2}>Compare selected scholarships</Button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-6xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col overflow-clip rounded-lg bg-background shadow-xl">
            <div className="shrink-0 border-b p-4 sm:p-6">
              <div className="mb-2 flex items-start justify-between gap-3">
                <Dialog.Title className="font-display text-2xl">Compare scholarships</Dialog.Title>
                <Dialog.Close asChild><Button variant="outline" aria-label="Close scholarship comparison">Close</Button></Dialog.Close>
              </div>
              <Dialog.Description className="text-sm text-muted-foreground">Check the same recorded details across your choices. Scroll the comparison to see every award.</Dialog.Description>
            </div>
            <div className="flex min-h-0 flex-col p-4 sm:p-6">
              <ScholarshipComparison scholarships={selected} now={now} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {selected.length > 0 && <Button variant="ghost" onClick={onClear} aria-label="Clear scholarship comparison">Clear</Button>}
    </div>
    {selected.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{selected.map((row, index) => <li key={row.id} className="max-w-full"><button className="max-w-full rounded-md border bg-background px-3 py-2 text-left text-sm [overflow-wrap:anywhere] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a1a27]" aria-label={`Remove ${row.title}, listing ${index + 1} from comparison`} onClick={() => onRemove(row.id)}>{row.title}<span className="ml-2" aria-hidden="true">×</span><span className="block text-xs text-muted-foreground">{row.provider_name}</span></button></li>)}</ul>}
    <p className="mt-3 text-xs text-muted-foreground">Choose up to three awards using Compare on their cards. Your selection stays while you browse pages and filters, and clears when you reload or change accounts.</p>
  </section>;
}
