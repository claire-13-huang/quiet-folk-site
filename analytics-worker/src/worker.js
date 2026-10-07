import html from './dashboard.html';
import css from './dashboard.css';
import js from './dashboard.js.txt';
const origins = new Set(['https://october-with-you.vercel.app','https://claire-13-huang.github.io']);
const journey = ['page_open','come_in','envelope_open','invitation_yes','meeting_confirm','food_choice','secret_letter_open'];
const allowed = new Set([...journey,'scene01_complete','replay','heartbeat','session_end']);
const foods = new Set(['Japanese / Sushi','Cha chaan teng','Korean','Italian / Pasta','We can decide later']);
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json',...extra}});
async function authorized(request,env) {
 if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 32) return false;
 const expected = 'Basic '+btoa('admin:'+env.ADMIN_PASSWORD);
 const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b] = await Promise.all([digest(request.headers.get('Authorization')||''),digest(expected)]);
 return a.reduce((difference,value,index)=>difference|(value^b[index]),0)===0;
}
function deviceInfo(ua) {
 const device = /iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':/Android.*Mobile/i.test(ua)?'Android phone':/Android/i.test(ua)?'Android tablet':/Mobile/i.test(ua)?'Mobile':'Desktop';
 const browser = /Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'Other';
 const os = /iPhone|iPad/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other';
 return {device,browser,os};
}
async function collect(request,env) {
 const origin=request.headers.get('Origin');
 if (!origins.has(origin)) return json({error:'Origin not allowed'},403);
 const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
 if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
 if (request.method!=='POST') return json({error:'Method not allowed'},405,cors);
 if (Number(request.headers.get('Content-Length')||0)>4096) return json({error:'Request too large'},413,cors);
 let data; try { const body=await request.text(); if(body.length>4096) return json({error:'Request too large'},413,cors); data=JSON.parse(body); } catch { return json({error:'Invalid JSON'},400,cors); }
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if (!data || !uuid.test(data.visitor_id) || !uuid.test(data.session_id) || !uuid.test(data.event_id) || !allowed.has(data.event) || !Number.isInteger(data.active_seconds) || data.active_seconds<0 || data.active_seconds>86400 || (data.event==='food_choice'&&!foods.has(data.food))) return json({error:'Invalid event'},400,cors);
 const now=Date.now(), stamp=Number(data.timestamp);
 if (!Number.isFinite(stamp)||stamp<now-86400000||stamp>now+300000) return json({error:'Invalid timestamp'},400,cors);
 const previous=await env.DB.prepare('SELECT visitor_id,origin,started FROM sessions WHERE session_id=?').bind(data.session_id).first();
 if (previous&&(previous.visitor_id!==data.visitor_id||previous.origin!==origin)) return json({error:'Session mismatch'},409,cors);
 const info=deviceInfo(request.headers.get('User-Agent')||'');
 const geo=request.cf||{};
 const country=typeof geo.country==='string'?geo.country.slice(0,8):'Unknown';
 const region=typeof geo.region==='string'?geo.region.slice(0,80):'Unknown';
 const active=Math.min(data.active_seconds,previous?Math.max(0,Math.ceil((now-previous.started)/1000)):30);
 await env.DB.batch([
 env.DB.prepare(`INSERT INTO sessions (session_id,visitor_id,origin,started,last_seen,active_seconds,device,browser,os,country,region,ended) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen),active_seconds=MAX(active_seconds,excluded.active_seconds),ended=CASE WHEN excluded.last_seen>=last_seen THEN excluded.ended ELSE ended END`).bind(data.session_id,data.visitor_id,origin,now,now,active,info.device,info.browser,info.os,country,region,data.event==='session_end'?1:0),
 env.DB.prepare('INSERT OR IGNORE INTO events (event_id,session_id,event,timestamp,food) VALUES (?,?,?,?,?)').bind(data.event_id,data.session_id,data.event,stamp,data.event==='food_choice'?data.food:null)
 ]);
 return json({ok:true},200,cors);
}
async function overview(env,range) {
 const hours=range==='24H'?24:range==='7D'?168:720, since=Date.now()-hours*3600000;
 const query=(sql,...args)=>env.DB.prepare(sql).bind(...args);
 const [metrics,counts,chart,recent,food,replays]=await Promise.all([
 query(`SELECT COUNT(*) visits,COUNT(DISTINCT visitor_id) visitors,COALESCE(AVG(active_seconds),0) average, SUM(CASE WHEN (SELECT COUNT(DISTINCT event) FROM events WHERE session_id=s.session_id AND event IN ('${journey.join("','")}'))=7 THEN 1 ELSE 0 END) completed FROM sessions s WHERE started>=?`,since).first(),
 query('SELECT event,COUNT(DISTINCT e.session_id) count FROM events e JOIN sessions s USING(session_id) WHERE s.started>=? GROUP BY event',since).all(),
 query('SELECT CAST(started / ? AS INTEGER) bucket,COUNT(*) count FROM sessions WHERE started>=? GROUP BY bucket ORDER BY bucket',hours===24?3600000:86400000,since).all(),
 query(`SELECT s.*, (SELECT COUNT(DISTINCT event) FROM events WHERE session_id=s.session_id AND event IN ('${journey.join("','")}')) progress FROM sessions s WHERE started>=? ORDER BY started DESC LIMIT 100`,since).all(),
 query('SELECT food,COUNT(DISTINCT e.session_id) count FROM events e JOIN sessions s USING(session_id) WHERE s.started>=? AND event=? GROUP BY food ORDER BY count DESC',since,'food_choice').all(),
 query('SELECT COUNT(*) count FROM events e JOIN sessions s USING(session_id) WHERE s.started>=? AND event=?',since,'replay').first()
 ]);
 // Each step requires all preceding steps in that session: skipped steps never inflate conversion.
 const funnel=[];
 for(let i=0;i<journey.length;i++) {
 const steps=journey.slice(0,i+1);
 const row=await query(`SELECT COUNT(*) count FROM sessions s WHERE started>=? AND (SELECT COUNT(DISTINCT event) FROM events WHERE session_id=s.session_id AND event IN (${steps.map(()=>'?').join(',')}))=?`,since,...steps,steps.length).first();
 funnel.push({event:journey[i],count:row.count});
 }
 return {metrics,counts:counts.results,chart:chart.results,sessions:recent.results,food:food.results,replays:replays.count,funnel,range,now:Date.now()};
}
export default {async fetch(request,env) {
 const path=new URL(request.url).pathname;
 try {
 if(path==='/collect') return await collect(request,env);
 if(path==='/health') return json({ok:true});
 if(path==='/admin'||path.startsWith('/admin/')) {
 if(!await authorized(request,env)) return new Response('Authentication required',{status:401,headers:{...headers,'WWW-Authenticate':'Basic realm="Private analytics", charset="UTF-8"'}});
 if(request.method!=='GET') return json({error:'Method not allowed'},405);
 if(path==='/admin'||path==='/admin/') return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 if(path==='/admin/style.css') return new Response(css,{headers:{...headers,'Content-Type':'text/css'}});
 if(path==='/admin/app.js') return new Response(js,{headers:{...headers,'Content-Type':'text/javascript'}});
 if(path==='/admin/api/overview') return json(await overview(env,new URL(request.url).searchParams.get('range')));
 if(path.startsWith('/admin/api/session/')) {
 const id=path.split('/').pop();
 const session=await env.DB.prepare('SELECT * FROM sessions WHERE session_id=?').bind(id).first();
 if(!session) return json({error:'Session not found'},404);
 const [visitor,events]=await Promise.all([env.DB.prepare('SELECT COUNT(*) visits,MIN(started) first_seen FROM sessions WHERE visitor_id=?').bind(session.visitor_id).first(),env.DB.prepare("SELECT event,timestamp,food FROM events WHERE session_id=? AND event!='heartbeat' ORDER BY timestamp").bind(id).all()]);
 return json({session,visitor,events:events.results});
 }
 }
 return json({error:'Not found'},404);
 } catch {return json({error:'Service unavailable'},503);}
}};
