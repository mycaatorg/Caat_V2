"use client";
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthContext';
import { EvidenceLibraryCard } from '@/components/profile/EvidenceLibraryCard';
export default function LibraryClient({ itemId }: { itemId?: string } = {}) {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="p-6">Loading your library…</p>;
  if (!user) return <p className="p-6"><Link className="underline" href="/login?next=%2Fworkspace%2Flibrary">Sign in to see your library</Link></p>;
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="max-w-2xl"><h1 className="text-3xl font-bold tracking-tight">Experience library</h1><p className="mt-2 text-sm text-muted-foreground">Keep the activities, awards and experience that tell your story. Find work to reuse and see which applications already use it.</p></header>
    <EvidenceLibraryCard key={`${user.id}:${itemId ?? ''}`} workspace itemId={itemId} />
  </div>;
}
