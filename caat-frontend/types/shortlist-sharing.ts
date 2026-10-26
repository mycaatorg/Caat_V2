export type ShareKind = 'course' | 'school' | 'major' | 'scholarship';
export type ShareSelection = {kind:ShareKind;id:string}[];
export type SharedItem = {kind:ShareKind;id:string;title:string;details:string[];sourceUrl:string|null};
export type SharedSnapshot = {items:SharedItem[];created_at:string;expires_at:string};
export type ShareRecord = SharedSnapshot & {id:string;user_id:string;token_hash:string;revision:string;revoked_at:string|null};
