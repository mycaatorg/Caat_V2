import {SharedShortlist} from '@/components/shortlist/shared-shortlist';
export const dynamic='force-dynamic';
export const metadata={title:'Shared shortlist',description:'Selected shortlist items shared with you.',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function SharedPage(){return <SharedShortlist/>;}
