import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalApiUrl} from './safety.mjs';
const url=process.env.SUPABASE_URL;assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}},ok=r=>{assert.ifError(r.error);return r.data;};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
async function login(email){const client=createClient(url,process.env.SUPABASE_ANON_KEY,opts);const session=ok(await client.auth.signInWithPassword({email,password:process.env.E2E_TEST_PASSWORD}));return {client,id:session.user.id};}
const owner=await login('e2e.student@caat.local.test'),peer=await login('e2e.peer@caat.local.test');
const id=randomUUID(),tag=randomUUID(),paths=['original','replacement','missing'].map(name=>`${owner.id}/transcripts/review-${tag}-${name}.pdf`);
const original='%PDF-1.4\nOriginal synthetic document\n%%EOF',replacement='%PDF-1.4\nReplacement synthetic document\n%%EOF';
const storage=owner.client.storage.from('user-documents');
const body=text=>new Blob([text],{type:'application/pdf'});
const state=async()=>ok(await admin.from('documents').select('status,review_notes,storage_path,file_name').eq('id',id).single());
const update=values=>owner.client.from('documents').update(values).eq('id',id).select().single();
try{
 const signed=ok(await storage.createSignedUploadUrl(paths[0],{upsert:true}));
 ok(await storage.upload(paths[0],body(original),{contentType:'application/pdf'}));
 ok(await owner.client.from('documents').insert({id,user_id:owner.id,storage_path:paths[0],file_name:'original.pdf',category:'transcripts',mime_type:'application/pdf',file_size:original.length,status:'verified',review_notes:'I approved this'}));
 assert.equal((await state()).status,'pending_review','new uploads cannot self-verify');assert.equal((await state()).review_notes,null);
 for(const values of [{status:'verified'},{status:'resubmit'},{review_notes:'approved by me'}])assert.equal((await update(values)).error?.code,'42501');
 ok(await admin.from('documents').update({status:'verified',review_notes:'Trusted reviewer feedback'}).eq('id',id));
 ok(await update({updated_at:new Date().toISOString()}));assert.equal((await state()).status,'verified','unrelated timestamp edit preserves review');
 assert.deepEqual(ok(await peer.client.from('documents').update({status:'verified',review_notes:'Peer approval'}).eq('id',id).select()),[]);
 assert.ok((await peer.client.storage.from('user-documents').download(paths[0])).error);
 // Ordinary owner writes cannot change bytes underneath the review.
 assert.ok((await storage.update(paths[0],body(replacement),{contentType:'application/pdf'})).error,'overwrite refused');
 assert.ok((await storage.upload(paths[0],body(replacement),{contentType:'application/pdf',upsert:true})).error,'upsert refused');
 ok(await storage.remove([paths[0]]));
 assert.ok((await storage.download(paths[0])).error,'owner deletion remains available for account cleanup');
 assert.equal((await state()).status,'pending_review','owner deletion cannot leave a verified badge');
 ok(await admin.storage.from('user-documents').upload(paths[0],body(original),{contentType:'application/pdf'}));
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 assert.ok((await storage.move(paths[0],paths[1])).error,'move of referenced object refused');
 ok(await storage.uploadToSignedUrl(paths[0],signed.token,body(replacement),{contentType:'application/pdf'}));
 assert.equal((await state()).status,'pending_review','pre-issued upload capability invalidates review when bytes change');
 assert.equal(await ok(await storage.download(paths[0])).text(),replacement);
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 assert.equal((await state()).status,'verified');assert.equal((await state()).review_notes,'Trusted reviewer feedback');
 // Missing referenced objects cannot be filled after they were marked reviewed.
 ok(await admin.from('documents').update({storage_path:paths[2]}).eq('id',id));
 assert.ok((await storage.upload(paths[2],body(replacement),{contentType:'application/pdf'})).error,'referenced path cannot be recreated');
 // Trusted object creation/deletion/replacement also invalidates stale reviews.
 ok(await admin.storage.from('user-documents').upload(paths[2],body(original),{contentType:'application/pdf'}));
 assert.equal((await state()).status,'pending_review','creating a referenced missing object invalidates review');
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 ok(await admin.storage.from('user-documents').remove([paths[2]]));
 assert.equal((await state()).status,'pending_review','deleting a referenced object invalidates review');
 ok(await admin.from('documents').update({storage_path:paths[0],status:'verified'}).eq('id',id));
 ok(await admin.storage.from('user-documents').update(paths[0],body(original),{contentType:'application/pdf'}));
 assert.equal((await state()).status,'pending_review','trusted overwrite invalidates review');
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 await ok(await storage.download(paths[0])).text();
 assert.equal((await state()).status,'verified','reading a reviewed object preserves review');
 // Direct metadata writes also invalidate old review, without requiring the UI reset.
 ok(await update({file_name:'renamed.pdf'}));assert.equal((await state()).status,'pending_review');
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 ok(await storage.upload(paths[1],body(replacement),{contentType:'application/pdf'}));
 ok(await update({storage_path:paths[1],file_name:'replacement.pdf',file_size:replacement.length}));
 assert.equal((await state()).status,'pending_review');assert.equal((await state()).review_notes,'Trusted reviewer feedback');
 ok(await storage.remove([paths[0]]));assert.ok((await storage.download(paths[0])).error,'old unreferenced object can be removed');
 ok(await admin.from('documents').update({status:'resubmit'}).eq('id',id));
 ok(await update({status:'pending_review'}));assert.equal((await state()).status,'pending_review','existing replace reset allowed');
 ok(await admin.from('documents').update({status:'verified'}).eq('id',id));
 ok(await owner.client.from('documents').delete().eq('id',id));
 ok(await storage.remove([paths[1]]));assert.ok((await storage.download(paths[1])).error,'delete row then object works');
 console.log('PASS document review: insert/update/notes/peer guards, trusted reviewer, stale metadata reset, owner Storage guards, signed/trusted write invalidation and ordinary replace/delete');
}finally{
 ok(await admin.from('documents').delete().eq('id',id));ok(await admin.storage.from('user-documents').remove(paths));
}
