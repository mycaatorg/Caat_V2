// @vitest-environment jsdom
import React from 'react';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {mountComponent,unmountAll,button,click} from './dom-helpers';
import {snapshotForCourse} from '@/lib/course-preparation-model';
import type {CourseOffering} from '@/types/courses';
const fetch=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/course-preparation',()=>({fetchCoursePreparation:fetch}));
import {CoursePreparationReview} from '@/components/today/course-preparation-review';
const course={id:'c',name:'Computing',school_id:1,active:true,prerequisites:'Maths',source_url:'https://example.edu'} as CourseOffering;
beforeEach(()=>fetch.mockReset());afterEach(unmountAll);
it('links a changed or unavailable check to its application even if previously reviewed',async()=>{
 fetch.mockResolvedValue({checks:[{id:'check',application_id:'app',course_id:'c',school_id:1,item_key:'prerequisites',reviewed:true,snapshot:snapshotForCourse(course,'prerequisites')}],courses:[{...course,prerequisites:null}]});
 const c=await mountComponent(<CoursePreparationReview/>);expect(c.querySelector('a')?.getAttribute('href')).toBe('/applications/app#course-preparation');expect(c.textContent).toContain('Computing');
});
it('makes failed review reads retryable and removes the warning when retry succeeds',async()=>{
 fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({checks:[],courses:[]});
 const c=await mountComponent(<CoursePreparationReview/>);expect(c.querySelector('[role="alert"]')).not.toBeNull();await click(button('Refresh course checks',c));expect(c.textContent).toBe('');
});
