/** SDKs can deliver events after route changes: filter each original event URL. */
export function filterShareTelemetry<T extends {url:string}>(event:T):T|null {
 try {
  const url=new URL(event.url);
  if(/^\/(?:share(?:\/|$)|shortlist\/share(?:\/|$))/.test(url.pathname))return null;
  url.hash='';
  return {...event,url:url.toString()};
 }catch{return null;}
}
