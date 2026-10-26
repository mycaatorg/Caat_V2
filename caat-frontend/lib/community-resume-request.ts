/** Bound a server-action wait, and release the timer after every outcome. */
export async function resumeRequest<T>(request:Promise<T>):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([request,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Resume request timed out')),15000);})]);}
 finally{clearTimeout(timer);}
}
