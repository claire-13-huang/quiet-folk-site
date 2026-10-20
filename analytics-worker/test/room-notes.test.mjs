import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { saveRoomNote, deliverFeedbackNotifications } from '../src/room-notes.js';

function database() {
 const sqlite = new DatabaseSync(':memory:');
 for (const file of ['0001_analytics.sql','0002_test_traffic.sql','0006_room_letters_feedback.sql']) sqlite.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
 return { prepare(sql) { return { bind(...args) { return { async first() { return sqlite.prepare(sql).get(...args) || null; }, async all() { return {results:sqlite.prepare(sql).all(...args)}; }, async run() { return sqlite.prepare(sql).run(...args); } }; } }; }, sqlite };
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
