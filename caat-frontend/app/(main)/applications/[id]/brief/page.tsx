import { PageHeader } from '@/components/PageHeader';
import ApplicationBriefClient from './client';
export const metadata={title:'Application brief'};
export default async function ApplicationBriefPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;return <><PageHeader title="Application brief"/><ApplicationBriefClient applicationId={id}/></>;
}
