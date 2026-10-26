type Reply<T>={data:T|null;error:{code?:string}|null};
export async function bounded<T>(run:(signal:AbortSignal)=>PromiseLike<Reply<T>>,message:string):Promise<T|null>{
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const response=await Promise.race([Promise.resolve(run(controller.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error(message));},12000);})]);
  if(response.error){
   if(response.error.code==='PT409')throw new Error('Information or this link changed. Refresh and preview again.');
   if(response.error.code==='54000')throw new Error('Remove an old shared link before creating another.');
   if(response.error.code==='42501')throw new Error('This action is unavailable. Sign in again and refresh your links.');
   throw new Error(message);
  }
  return response.data;
 }finally{if(timer)clearTimeout(timer);}
}
