import {it,expect} from 'vitest';
import {filterShareTelemetry} from '@/lib/share-telemetry';
it('drops share pages, including delayed telemetry after navigating away',()=>{expect(filterShareTelemetry({url:'https://mycaat.com/share/shortlist#secret',type:'pageview'})).toBeNull();expect(filterShareTelemetry({url:'https://mycaat.com/shortlist/share',type:'event'})).toBeNull();});
it('strips fragments elsewhere without losing event fields',()=>{expect(filterShareTelemetry({url:'https://mycaat.com/courses#secret',type:'pageview'})).toEqual({url:'https://mycaat.com/courses',type:'pageview'});});
it('drops malformed telemetry URLs',()=>expect(filterShareTelemetry({url:'garbage'})).toBeNull());
