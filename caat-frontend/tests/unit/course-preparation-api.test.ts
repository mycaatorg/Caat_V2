import { rangedFixture } from "./ranged-fixture";
import {beforeEach,it,expect,vi} from 'vitest';
import {createMockSupabase} from './mock-supabase';
const io=vi.hoisted(()=>({client:null as unknown}));
vi.mock('@/lib/supabase/client',()=>({supabase:new Proxy({},{get:(_,key)=>Reflect.get(io.client as object,key)})}));
vi.mock('@/lib/current-user',()=>({getClientUserId:async()=> 'owner'}));
import {fetchCoursePreparation,saveCoursePreparation} from '@/lib/course-preparation';
import type {CourseOffering} from '@/types/courses';
beforeEach(()=>{io.client=createMockSupabase({resolver:()=>({data:[]})});});
it('refreshes current bookmarks and scopes them to the application school instead of stale UI props',async()=>{
 const client=createMockSupabase({resolver:q=>({data:rangedFixture(q.table==='user_course_bookmarks'?[{course_id:'saved-now'}]:q.table==='course_preparation_checks'?[{course_id:'unsaved-plan'}]:[],q.calls)})});io.client=client;
 const result=await fetchCoursePreparation('app',1);
 expect(result.savedCourseIds).toEqual(['saved-now']);
 const bookmark=client.queries.find(q=>q.table==='user_course_bookmarks');
 expect(bookmark?.calls).toEqual(expect.arrayContaining([{method:'eq',args:['user_id','owner']},{method:'eq',args:['course_offerings.school_id',1]}]));
 const courses=client.queries.find(q=>q.table==='course_offerings');expect(courses?.calls).toContainEqual({method:'in',args:['id',['unsaved-plan','saved-now']]});
});
it('fails closed if saved courses cannot be read',async()=>{
 io.client=createMockSupabase({resolver:q=>q.table==='user_course_bookmarks'?{error:{message:'offline'}}:{data:[]}});
 await expect(fetchCoursePreparation('app',1)).rejects.toThrow(/load/i);
});
it('rejects an empty RPC response rather than reporting a completed check',async()=>{
 await expect(saveCoursePreparation({applicationId:'app',course:{id:'c'} as CourseOffering,key:'prerequisites',action:'start'})).rejects.toThrow(/save/i);
});

it.each(['PT409','40001','23505'])('shows refresh guidance for conflict %s without retrying the write',async(code)=>{
 const client=createMockSupabase({rpc:()=>({error:{message:'Conflict',code}})});io.client=client;
 await expect(saveCoursePreparation({applicationId:'app',course:{id:'c'} as CourseOffering,key:'prerequisites',action:'start'})).rejects.toThrow('changed elsewhere. Refresh and review');
 expect(client.rpc).toHaveBeenCalledTimes(1);
});
