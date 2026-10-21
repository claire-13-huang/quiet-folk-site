import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { requestIP,describeVisitors } from '../src/visitor-identity.js';
const bundled=await build({entryPoints:[fileURLToPath(new URL('../src/worker.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'neutral',loader:{'.html':'text','.css':'text','.txt':'text'}});
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function database(beforeScope=false){const sqlite=new DatabaseSync(':memory:');const dir=new URL('../migrations/',import.meta.url);for(const file of readdirSync(dir).filter(f=>f.endsWith('.sql')&&(!beforeScope||f<'0009')).sort())sqlite.exec(readFileSync(new URL(file,dir),'utf8'));const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values)},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}});return {sqlite,prepare:statement,async batch(rows){sqlite.exec('BEGIN');try{const result=rows.map(r=>sqlite.prepare(r.sql).run(...r.args));sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}}}
const origin='https://october-with-you.vercel.app',password='LOCAL_TEST_ONLY_ADMIN_PASSWORD_123456789';
function collect(env,visitor,session,ip,site=origin){return worker.fetch(new Request('https://worker.test/collect',{method:'POST',headers:{Origin:site,'Content-Type':'text/plain','CF-Connecting-IP':ip,'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/155.0.0.0'},body:JSON.stringify({visitor_id:visitor,session_id:session,event_id:randomUUID(),event:'page_open',timestamp:Date.now(),active_seconds:0,page_path:'/'})}),env,{waitUntil(p){p.catch(()=>{})}})}
function admin(env,path){return worker.fetch(new Request('https://worker.test'+path,{headers:{Authorization:'Basic '+btoa('admin:'+password)}}),env,{waitUntil(){}})}
test('confirmed browser survives IP changes; shared IP never confirms a different browser',async()=>{
 const DB=database(),env={DB,ADMIN_PASSWORD:password},visitor=randomUUID(),first=randomUUID();
 let response=await collect(env,visitor,first,'198.51.100.8');assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
 DB.sqlite.prepare('INSERT INTO visitor_names VALUES(?,?,?,?)').run(visitor,origin,'Colette',Date.now());
 const second=randomUUID();assert.equal((await collect(env,visitor,second,'203.0.113.9')).status,200);
 let detail=await(await admin(env,'/admin/api/session/'+second)).json();assert.equal(detail.session.display_name,'Colette');assert.equal(detail.session.os,'macOS');assert.equal(detail.session.ip_addresses[0].ip,'203.0.113.9');
 const stranger=randomUUID(),sameIP=randomUUID();await collect(env,stranger,sameIP,'198.51.100.8');detail=await(await admin(env,'/admin/api/session/'+sameIP)).json();assert.equal(detail.session.display_name,null);assert.deepEqual(detail.session.ip_matches,['Colette']);
 const another=randomUUID();await collect(env,randomUUID(),another,'192.0.2.10');detail=await(await admin(env,'/admin/api/session/'+another)).json();assert.deepEqual(detail.session.ip_matches,[]);
 const otherOrigin=randomUUID();await collect(env,visitor,otherOrigin,'198.51.100.8','https://claire-13-huang.github.io');detail=await(await admin(env,'/admin/api/session/'+otherOrigin)).json();assert.equal(detail.session.display_name,null);assert.deepEqual(detail.session.ip_matches,[]);
 const overview=await(await admin(env,'/admin/api/overview?range=24H')).json();assert.equal(overview.metrics.visits,5);assert.equal(overview.metrics.visitors,3);assert.equal(overview.sessions.find(s=>s.session_id===first).display_name,'Colette');
 assert.equal((await worker.fetch(new Request('https://worker.test/admin/api/overview'),env,{})).status,401);
 DB.sqlite.close();
});
test('IP records do not inflate visits and invalid headers are not stored',async()=>{
 const DB=database(),env={DB,ADMIN_PASSWORD:password},visitor=randomUUID(),session=randomUUID();await collect(env,visitor,session,'2001:db8:0:0:0:0:0:1');await collect(env,visitor,session,'2001:db8::1');
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM session_ips').get().n,1);assert.equal(DB.sqlite.prepare('SELECT ip FROM session_ips').get().ip,'2001:db8::1');assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM sessions').get().n,1);
 const bad=randomUUID();await collect(env,visitor,bad,'999.1.2.3');assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM session_ips WHERE session_id=?').get(bad).n,0);
 assert.equal(requestIP(new Request('https://test',{headers:{'CF-Connecting-IP':'not-an-ip'}})),null);
 assert.equal(requestIP(new Request('https://test',{headers:{'CF-Connecting-IP':'127.0.0.1, 10.0.0.1'}})),null);
 assert.equal((await collect(env,visitor,randomUUID(),'192.0.2.1','https://untrusted.invalid')).status,403);
 DB.sqlite.close();
});
test('100 recent visits with multiple IPs stay within D1 parameter limits',async()=>{
 const DB=database(),visitor=randomUUID(),now=Date.now();
 DB.sqlite.prepare('INSERT INTO visitor_names VALUES(?,?,?,?)').run(visitor,origin,'Colette',now);
 const rows=[];
 for(let i=0;i<100;i++){
  const session=randomUUID();DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(session,i===0?visitor:randomUUID(),origin,now,now,0,'Desktop','Chrome','macOS','HK','Unknown',0,0);
  DB.sqlite.prepare('INSERT INTO session_ips VALUES(?,?,?,?,?)').run(session,`198.51.100.${i+1}`,now,now,'request');rows.push(DB.sqlite.prepare('SELECT * FROM sessions WHERE session_id=?').get(session));
 }
 DB.sqlite.prepare('INSERT INTO session_ips VALUES(?,?,?,?,?)').run(rows[0].session_id,'2001:db8::1',now,now,'request');
 DB.sqlite.prepare('INSERT INTO session_ips VALUES(?,?,?,?,?)').run(rows[99].session_id,'198.51.100.1',now,now,'request');
 const limited={prepare(sql){const query=DB.prepare(sql);return {...query,bind(...args){assert.ok(args.length<=100,'D1 allows at most 100 bound parameters');return query.bind(...args)}}}};
 const described=await describeVisitors({DB:limited},rows);assert.equal(described.length,100);assert.deepEqual(described[99].ip_matches,['Colette']);assert.equal(described[99].display_name,null);DB.sqlite.close();
});
test('excluding one QA session does not exclude the real visitor or future visits',async()=>{
 const DB=database(),env={DB,ADMIN_PASSWORD:password},visitor=randomUUID(),real=randomUUID(),qa=randomUUID();
 await collect(env,visitor,real,'198.51.100.8');await collect(env,visitor,qa,'203.0.113.9');DB.sqlite.prepare('INSERT INTO visitor_names VALUES(?,?,?,?)').run(visitor,origin,'Colette',Date.now());
 DB.sqlite.prepare('INSERT INTO session_test_exclusions VALUES(?,?,?)').run(qa,'isolated_qa_session',Date.now());DB.sqlite.prepare('UPDATE sessions SET is_test=1 WHERE session_id=?').run(qa);
 const next=randomUUID();await collect(env,visitor,next,'198.51.100.9');let detail=await(await admin(env,'/admin/api/session/'+next)).json();assert.equal(detail.session.is_test,0);assert.equal(detail.session.display_name,'Colette');assert.equal(detail.visitor.visits,2);assert.equal(detail.visitor.is_test,0);
 detail=await(await admin(env,'/admin/api/session/'+qa)).json();assert.equal(detail.session.display_name,null);assert.equal(detail.session.is_test,1);assert.equal(detail.visitor.is_test,0);
 let overview=await(await admin(env,'/admin/api/overview?range=24H')).json();assert.equal(overview.metrics.visits,2);assert.ok(overview.sessions.every(s=>s.session_id!==qa));
 const mark=flag=>worker.fetch(new Request('https://worker.test/admin/api/session/'+real+'/test',{method:'POST',headers:{Authorization:'Basic '+btoa('admin:'+password),Origin:'https://worker.test','Content-Type':'application/json'},body:JSON.stringify({is_test:flag})}),env,{});
 assert.equal((await mark(true)).status,200);const other=randomUUID();await collect(env,visitor,other,'192.0.2.8');assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(other).is_test,1);
 assert.equal((await mark(false)).status,200);assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(qa).is_test,1);assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(real).is_test,0);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM test_visitors').get().n,0);DB.sqlite.close();
});

test('scope migration retains browser-wide tests without excluding mixed real visitors',async()=>{
 const DB=database(true),onlyTest=randomUUID(),mixed=randomUUID(),legacyTest=randomUUID(),mixedReal=randomUUID(),now=Date.now();
 for(const [visitor,flag,session] of [[onlyTest,1,randomUUID()],[onlyTest,1,randomUUID()],[mixed,1,legacyTest],[mixed,0,mixedReal]])DB.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(session,visitor,origin,now,now,0,'Desktop','Chrome','macOS','HK','Unknown',0,flag);
 DB.sqlite.exec(readFileSync(new URL('../migrations/0009_test_visitor_scope.sql',import.meta.url),'utf8'));
 DB.sqlite.exec(readFileSync(new URL('../migrations/0010_legacy_test_session_exclusions.sql',import.meta.url),'utf8'));
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM test_visitors').get().n,1);
 assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM session_test_exclusions WHERE session_id=?').get(legacyTest).n,1);
 const env={DB,ADMIN_PASSWORD:password};
 for(const flag of [true,false])assert.equal((await worker.fetch(new Request('https://worker.test/admin/api/session/'+mixedReal+'/test',{method:'POST',headers:{Authorization:'Basic '+btoa('admin:'+password),Origin:'https://worker.test','Content-Type':'application/json'},body:JSON.stringify({is_test:flag})}),env,{})).status,200);
 assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(legacyTest).is_test,1);
 assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(mixedReal).is_test,0);
 const a=randomUUID(),b=randomUUID();await collect({DB},onlyTest,a,'192.0.2.1');await collect({DB},mixed,b,'192.0.2.2');
 assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(a).is_test,1);assert.equal(DB.sqlite.prepare('SELECT is_test FROM sessions WHERE session_id=?').get(b).is_test,0);DB.sqlite.close();
});
