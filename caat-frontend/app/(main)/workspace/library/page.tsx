import { PageHeader } from '@/components/PageHeader';
import LibraryClient from './client';
export const metadata = { title: 'Experience library' };
export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ item?: string | string[] }> }) {
  const params = await searchParams;
  const itemId = Array.isArray(params.item) ? params.item[0] : params.item;
  return <><PageHeader title="Experience library" /><LibraryClient itemId={itemId} /></>;
}
