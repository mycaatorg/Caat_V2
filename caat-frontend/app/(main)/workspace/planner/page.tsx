import { PageHeader } from '@/components/PageHeader';
import PlannerClient from './client';
export const metadata={title:'Planning timeline'};
export default function PlannerPage(){return <><PageHeader title="Planning timeline"/><PlannerClient/></>;}
