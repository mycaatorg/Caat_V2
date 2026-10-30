import { PageHeader } from '@/components/PageHeader';
import LibraryClient from './client';
export const metadata = { title: 'Experience library' };
export default function LibraryPage() { return <><PageHeader title="Experience library" /><LibraryClient /></>; }
