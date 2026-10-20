import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { saveRoomNote, deliverFeedbackNotifications, deliverRoomNoteNotifications } from '../src/room-notes.js';

function database() {
 const sqlite = new DatabaseSync(':memory:');
 for (const file of ['0001_analytics.sql','0002_test_traffic.sql','0006_room_letters_feedback.sql','0007_room_archives.sql']) sqlite.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
 const statement = (sql,args=[]) => ({sql,args,bind(...values){return statement(sql,values)},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}});
 return { prepare:statement, async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>sqlite.prepare(s.sql).run(...s.args));sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}},sqlite };
}
const origin = 'https://october-with-you.vercel.app';
function submit(env,kind,data) {
 return saveRoomNote(new Request(`https://worker.test/room/${kind}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)}),env,{waitUntil(promise){return promise;}},kind);
}
test('rating-only save, sealed retry, private isolation and email failure recovery',async () => {
 const DB=database(),env={DB},identity={visitor_id:randomUUID(),session_id:randomUUID()};
 const letter={id:randomUUID(),...identity,content:'PRIVATE_CONTENT_MUST_NEVER_BE_EMAILED'};
 assert.equal((await submit(env,'private',letter)).status,200);
 assert.equal((await submit(env,'private',letter)).status,200);
 const note={id:randomUUID(),...identity,rating:4};
 assert.equal((await submit(env,'feedback',note)).status,200);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM feedback').get().n,1);
 assert.equal(DB.sqlite.prepare('SELECT message FROM feedback').get().message,'');
 const sealed={...note,rating:5,message:'PUBLIC_FEEDBACK_ONLY',sealed:true};
 assert.equal((await submit(env,'feedback',sealed)).status,200);
 assert.equal((await submit(env,'feedback',sealed)).status,200);
 const deliveryEnv={...env,RESEND_API_KEY:'local-fake-key',RESEND_FROM_EMAIL:'test@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'};
 const now=Date.now()+1000;
 await deliverFeedbackNotifications(deliveryEnv,async()=>new Response('',{status:503}),now);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM feedback').get().n,1);
 assert.equal(DB.sqlite.prepare('SELECT status FROM feedback_notifications').get().status,'pending');
 let mail;
 await deliverFeedbackNotifications(deliveryEnv,async(_url,options)=>{mail=JSON.parse(options.body);return Response.json({id:'local-provider-receipt'});},now+3600000);
 assert.ok(mail.text.includes('PUBLIC_FEEDBACK_ONLY'));
 assert.ok(!JSON.stringify(mail).includes('PRIVATE_CONTENT'));
 assert.equal(DB.sqlite.prepare('SELECT status FROM feedback_notifications').get().status,'sent');
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,0);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM private_letters').get().n,1);
 DB.sqlite.close();
});
test('concurrent ownership/content conflicts cannot overwrite notes or falsely acknowledge writes',async()=>{
 const DB=database(),env={DB},id=randomUUID(),identity={visitor_id:randomUUID(),session_id:randomUUID()};
 const replies=await Promise.all([submit(env,'private',{id,...identity,content:'first'}),submit(env,'private',{id,...identity,content:'other'})]);
 assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
 const feedbackId=randomUUID();
 const replies2=await Promise.all([submit(env,'feedback',{id:feedbackId,...identity,rating:2}),submit(env,'feedback',{id:feedbackId,visitor_id:randomUUID(),session_id:randomUUID(),rating:5})]);
 assert.deepEqual(replies2.map(r=>r.status).sort(),[200,409]);
 assert.equal(DB.sqlite.prepare('SELECT rating FROM feedback').get().rating,2);
 DB.sqlite.close();
});
test('test feedback never creates or sends a notification',async()=>{
 const DB=database(),now=Date.now(),identity={visitor_id:randomUUID(),session_id:randomUUID()};
 DB.sqlite.prepare('INSERT INTO sessions(session_id,visitor_id,origin,started,last_seen,device,browser,os,country,region,is_test) VALUES(?,?,?,?,?,?,?,?,?,?,1)').run(identity.session_id,identity.visitor_id,origin,now,now,'test','test','test','test','test');
 assert.equal((await submit({DB},'feedback',{id:randomUUID(),...identity,rating:5,message:'test',sealed:true})).status,200);
 let calls=0;
 await deliverFeedbackNotifications({DB,RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'test@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'},async()=>{calls++;return Response.json({id:'unexpected'});});
 assert.equal(calls,0);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM feedback_notifications').get().n,0);
 DB.sqlite.close();
});

test('private reminders and archive edit/delete are durable, owned, idempotent and never contain prose',async()=>{
 const DB=database(),env={DB},identity={visitor_id:randomUUID(),session_id:randomUUID()},id=randomUUID();
 const letter={id,...identity,content:'PRIVATE_ARCHIVE_ORIGINAL'};
 assert.equal((await submit(env,'private',letter)).status,200);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM room_note_changes').get().n,1);
 const read=await (await submit(env,'private',{id,...identity,action:'read'})).json();
 assert.equal(read.content,letter.content);assert.equal(read.revision,0);
 assert.equal((await submit(env,'private',{id,...identity,visitor_id:randomUUID(),action:'read'})).status,409);
 const edit={id,...identity,action:'edit',revision:0,operation_id:randomUUID(),content:'PRIVATE_ARCHIVE_EDITED'};
 assert.equal((await submit(env,'private',edit)).status,200);
 assert.equal((await submit(env,'private',edit)).status,200);
 assert.equal((await submit(env,'private',{...edit,operation_id:randomUUID(),content:'stale draft'})).status,409);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM room_note_changes').get().n,2);
 const delivery={...env,RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'test@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'};
 const mails=[];
 await deliverRoomNoteNotifications(delivery,async(_url,options)=>{mails.push(options.body);return Response.json({id:randomUUID()})},Date.now()+1000);
 assert.equal(mails.length,2);assert.ok(mails.every(x=>!x.includes('PRIVATE_ARCHIVE')));
 const deletion={id,...identity,action:'delete',revision:1,operation_id:randomUUID()};
 assert.equal((await submit(env,'private',deletion)).status,200);assert.equal((await submit(env,'private',deletion)).status,200);
 assert.equal((await submit(env,'private',letter)).status,410);
 assert.equal((await (await submit(env,'private',{id,...identity,action:'read'})).json()).deleted,true);
 assert.equal(DB.sqlite.prepare('SELECT content FROM private_letters').get().content,' ');
 DB.sqlite.close();
});
test('feedback mail freezes its original payload, edits have separate notices, and stale deletes cancel nothing',async()=>{
 const DB=database(),env={DB},identity={visitor_id:randomUUID(),session_id:randomUUID()},id=randomUUID();
 await submit(env,'feedback',{id,...identity,rating:4,message:'ORIGINAL_MAIL',sealed:true});
 const edits=[{id,...identity,action:'edit',operation_id:randomUUID(),revision:0,rating:5,message:'UPDATED_NOTE'},{id,...identity,action:'delete',operation_id:randomUUID(),revision:0}];
 const replies=await Promise.all(edits.map(data=>submit(env,'feedback',data)));
 assert.deepEqual(replies.map(r=>r.status),[200,409]);
 assert.equal(DB.sqlite.prepare('SELECT status FROM feedback_notifications').get().status,'pending');
 assert.equal(DB.sqlite.prepare('SELECT status FROM room_note_changes').get().status,'pending');
 const delivery={...env,RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'test@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'};let first;
 await deliverFeedbackNotifications(delivery,async(_url,options)=>{first=options.body;return Response.json({id:randomUUID()})},Date.now()+1000);
 assert.ok(first.includes('ORIGINAL_MAIL'));assert.ok(!first.includes('UPDATED_NOTE'));
 assert.equal(DB.sqlite.prepare('SELECT message_snapshot FROM feedback_notifications').get().message_snapshot,null);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM events').get().n,0);
 DB.sqlite.close();
});
test('legacy and test private letters are never retroactively notified',async()=>{
 const DB=database(),now=Date.now(),identity={visitor_id:randomUUID(),session_id:randomUUID()};
 DB.sqlite.prepare('INSERT INTO private_letters(id,visitor_id,session_id,origin,content,created_at,notify_enabled) VALUES(?,?,?,?,?,?,0)').run(randomUUID(),identity.visitor_id,identity.session_id,origin,'LEGACY PRIVATE',now);
 DB.sqlite.prepare('INSERT INTO sessions(session_id,visitor_id,origin,started,last_seen,device,browser,os,country,region,is_test) VALUES(?,?,?,?,?,?,?,?,?,?,1)').run(identity.session_id,identity.visitor_id,origin,now,now,'test','test','test','test','test');
 await submit({DB},'private',{id:randomUUID(),...identity,content:'TEST PRIVATE'});
 let calls=0;await deliverRoomNoteNotifications({DB,RESEND_API_KEY:'fake',RESEND_FROM_EMAIL:'test@example.invalid',NOTIFICATION_TO:'recipient@example.invalid'},async()=>{calls++;return Response.json({id:'unexpected'})});
 assert.equal(calls,0);assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM room_note_changes').get().n,0);DB.sqlite.close();
});
