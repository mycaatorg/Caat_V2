// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Page from '@/app/(main)/schools/[id]/page';
const io = vi.hoisted(() => ({ note: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 1, name: 'Test school' }, error: null }) }) }) }) }) }));
vi.mock('@/app/(main)/schools/[id]/notes-actions', () => ({ fetchSchoolNoteAction: io.note, saveSchoolNoteAction: io.save }));
vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => null }));
vi.mock('@/app/(main)/schools/[id]/bookmark-button', () => ({ default: () => null }));
vi.mock('@/app/(main)/schools/[id]/application-button', () => ({ default: () => null }));
vi.mock('@/app/(main)/schools/[id]/SchoolScholarshipsSection', () => ({ SchoolScholarshipsSection: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }), notFound: () => { throw new Error('not found'); } }));
beforeEach(() => { io.save.mockReset(); });
afterEach(cleanup);
it('renders recovery instead of an empty editable note after a database read failure', async () => {
  io.note.mockResolvedValue({ note: { notes: '', updated_at: null }, error: 'Could not load note.', ownerId: 'owner-a' });
  render(await Page({ params: Promise.resolve({ id: '1' }) }));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry loading notes' })).toBeInTheDocument();
  expect(io.save).not.toHaveBeenCalled();
});
it('shows the account-read failure even when its owner is unknown', async () => {
  io.note.mockResolvedValue({ note: { notes: '', updated_at: null }, error: 'Could not load note.', ownerId: null });
  render(await Page({ params: Promise.resolve({ id: '1' }) }));
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
