'use client';
import {Analytics} from '@vercel/analytics/next';
import {SpeedInsights} from '@vercel/speed-insights/next';
import {filterShareTelemetry} from '@/lib/share-telemetry';
export function SiteTelemetry(){return <><Analytics beforeSend={filterShareTelemetry}/><SpeedInsights beforeSend={filterShareTelemetry}/></>;}
