const origins = new Set(['https://october-with-you.vercel.app', 'https://claire-13-huang.github.io']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const baseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (data, status = 200, cors = {}) => new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...cors, 'Content-Type': 'application/json' } });

export async function saveRoomNote(request, env, ctx, kind) {
 const origin = request.headers.get('Origin');
 if (!origins.has(origin) && !(env.ROOM_DEV_ORIGIN && origin === env.ROOM_DEV_ORIGIN)) return json({ error: 'Origin not allowed' }, 403);
 const cors = { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
 if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
 if (Number(request.headers.get('Content-Length') || 0) > 65536) return json({ error: 'This note is too long.' }, 413, cors);
 let data;
 try { const body = await request.text(); if (body.length > 65536) return json({ error: 'This note is too long.' }, 413, cors); data = JSON.parse(body); }
 catch { return json({ error: 'Invalid note.' }, 400, cors); }
 if (!data || !uuid.test(data.id) || !uuid.test(data.visitor_id) || !uuid.test(data.session_id)) return json({ error: 'Invalid visit.' }, 400, cors);
 const fields = kind === 'private' ? ['id','visitor_id','session_id','content'] : ['id','visitor_id','session_id','rating','message','sealed'];
 if (Object.keys(data).some(key => !fields.includes(key))) return json({ error: 'Invalid note fields.' }, 400, cors);
 const table = kind === 'private' ? 'private_letters' : 'feedback';
 const previous = await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(data.id).first();
 if (previous && (previous.origin !== origin || previous.visitor_id !== data.visitor_id || previous.session_id !== data.session_id)) return json({ error: 'Note identifier already used.' }, 409, cors);
 const visit = await env.DB.prepare('SELECT visitor_id,origin,is_test FROM sessions WHERE session_id=?').bind(data.session_id).first();
 if (visit && (visit.visitor_id !== data.visitor_id || visit.origin !== origin)) return json({ error: 'Visit mismatch.' }, 409, cors);
 const now = Date.now(), test = visit?.is_test || 0;
 if (!previous) {
  const count = await env.DB.prepare(`SELECT COUNT(*) n FROM ${table} WHERE visitor_id=? AND origin=? AND created_at>?`).bind(data.visitor_id, origin, now - 3600000).first();
  if (count.n >= 12) return json({ error: 'Please leave this note a little later.' }, 429, cors);
 }
 if (kind === 'private') {
  if (typeof data.content !== 'string' || !data.content.trim() || data.content.length > 12000) return json({ error: 'Write a little something first (up to 12,000 characters).' }, 400, cors);
  if (previous && previous.content !== data.content) return json({ error: 'This letter has already been kept. Open a new one to write again.' }, 409, cors);
  await env.DB.prepare('INSERT OR IGNORE INTO private_letters(id,visitor_id,session_id,origin,content,created_at,is_test) VALUES(?,?,?,?,?,?,?)').bind(data.id, data.visitor_id, data.session_id, origin, data.content, now, test).run();
  const saved = await env.DB.prepare('SELECT visitor_id,session_id,origin,content FROM private_letters WHERE id=?').bind(data.id).first();
  if (!saved || saved.visitor_id !== data.visitor_id || saved.session_id !== data.session_id || saved.origin !== origin || saved.content !== data.content) return json({ error: 'This letter identifier is already in use. Your words are still here.' }, 409, cors);
  // Private prose never enters events, feedback or notification delivery.
  return json({ ok: true, id: data.id }, 200, cors);
 }
 if (data.rating !== undefined && data.rating !== null && (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5)) return json({ error: 'Choose between one and five stars.' }, 400, cors);
 if (data.sealed !== undefined && typeof data.sealed !== 'boolean') return json({ error: 'Invalid note state.' }, 400, cors);
 if (data.message !== undefined && (typeof data.message !== 'string' || data.message.length > 8000)) return json({ error: 'Keep this note within 8,000 characters.' }, 400, cors);
 const rating = data.rating ?? previous?.rating ?? null, message = data.sealed ? (data.message ?? '') : (previous?.message ?? '');
 if (!rating && !message.trim()) return json({ error: 'Leave a star or a little note first.' }, 400, cors);
 if (previous?.sealed_at) {
  if (data.sealed && (previous.message !== message || previous.rating !== rating)) return json({ error: 'This note has already been sent.' }, 409, cors);
  return json({ ok: true, id: data.id, sealed: true }, 200, cors);
 }
 await env.DB.prepare(`INSERT INTO feedback(id,visitor_id,session_id,origin,rating,message,created_at,updated_at,sealed_at,is_test) VALUES(?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET rating=excluded.rating,message=excluded.message,updated_at=excluded.updated_at,sealed_at=excluded.sealed_at WHERE feedback.sealed_at IS NULL AND feedback.visitor_id=excluded.visitor_id AND feedback.session_id=excluded.session_id AND feedback.origin=excluded.origin`).bind(data.id, data.visitor_id, data.session_id, origin, rating, message, now, now, data.sealed ? now : null, test).run();
 const saved = await env.DB.prepare('SELECT visitor_id,session_id,origin,rating,message,sealed_at FROM feedback WHERE id=?').bind(data.id).first();
 if (!saved || saved.visitor_id !== data.visitor_id || saved.session_id !== data.session_id || saved.origin !== origin || saved.rating !== rating || saved.message !== message || (!!saved.sealed_at !== !!data.sealed)) return json({ error: 'This note changed while it was being kept. Please try again.' }, 409, cors);
 if (data.sealed && !test) {
  try { await env.DB.prepare('INSERT OR IGNORE INTO feedback_notifications(feedback_id,next_attempt) VALUES(?,?)').bind(data.id, now).run(); }
  catch { console.warn('Feedback notice deferred; note safely stored'); }
  ctx.waitUntil(deliverFeedbackNotifications(env, fetch, now, data.id).catch(() => console.warn('Feedback notice deferred')));
 }
 return json({ ok: true, id: data.id, sealed: !!data.sealed }, 200, cors);
}

export async function deliverFeedbackNotifications(env, send = fetch, now = Date.now(), feedbackId = null) {
 if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.NOTIFICATION_TO) return { configured: false, sent: 0 };
 await env.DB.prepare(`INSERT OR IGNORE INTO feedback_notifications(feedback_id,next_attempt) SELECT id,? FROM feedback f WHERE sealed_at IS NOT NULL AND is_test=0 AND NOT EXISTS (SELECT 1 FROM feedback_notifications n WHERE n.feedback_id=f.id) LIMIT 100`).bind(now).run();
 const { results: rows } = await env.DB.prepare(`SELECT n.*,f.rating,f.message FROM feedback_notifications n JOIN feedback f ON f.id=n.feedback_id WHERE n.status='pending' AND n.next_attempt<=? AND f.is_test=0 AND (? IS NULL OR n.feedback_id=?) ORDER BY n.next_attempt LIMIT 10`).bind(now, feedbackId, feedbackId).all();
 let sent = 0;
 for (const row of rows) {
  const lock = await env.DB.prepare("UPDATE feedback_notifications SET next_attempt=? WHERE feedback_id=? AND status='pending' AND next_attempt<=? RETURNING feedback_id").bind(now + 300000, row.feedback_id, now).first();
  if (!lock) continue;
  try {
   const response = await send('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `quiet-folk/feedback/${row.feedback_id}` }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [env.NOTIFICATION_TO], subject: 'Quiet Folk：收到一封网站反馈', text: [`评分：${row.rating ?? '未评分'}/5`, '', row.message || '这位访客只留下了评分。', '', `反馈编号：${row.feedback_id}`].join('\n') }), signal: AbortSignal.timeout(15000) });
   if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
   const result = await response.json();
   if (!result.id) throw new Error('Resend response missing email ID');
   await env.DB.prepare("UPDATE feedback_notifications SET status='sent',provider_id=?,api_status=?,last_error=NULL WHERE feedback_id=?").bind(result.id, response.status, row.feedback_id).run(); sent++;
  } catch (error) {
   const attempts = row.attempts + 1;
   await env.DB.prepare('UPDATE feedback_notifications SET attempts=?,status=?,next_attempt=?,last_error=? WHERE feedback_id=?').bind(attempts, attempts >= 8 ? 'failed' : 'pending', now + Math.min(3600000, 60000 * 2 ** attempts), String(error.message).slice(0,120), row.feedback_id).run();
  }
  await new Promise(resolve => setTimeout(resolve, 550));
 }
 return { configured: true, sent };
}

export async function readRoomNotes(env) {
 const [letters, feedback] = await Promise.all([
  env.DB.prepare('SELECT id,visitor_id,session_id,content,created_at,is_test FROM private_letters ORDER BY created_at DESC LIMIT 100').all(),
  env.DB.prepare('SELECT f.*,n.status notification_status,n.provider_id FROM feedback f LEFT JOIN feedback_notifications n ON f.id=n.feedback_id ORDER BY f.created_at DESC LIMIT 100').all()
 ]);
 return { private_letters: letters.results, feedback: feedback.results };
}

export async function roomNotesPage(env) {
 const data = await readRoomNotes(env);
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
 const date = value => new Date(value).toLocaleString('zh-CN', { timeZone:'Asia/Shanghai' });
 const cards = (rows, privateLetter) => rows.map(row => `<article class="panel" style="padding:24px;margin:16px 0"><small>${escape(date(row.created_at))}${row.is_test ? ' · 测试记录' : ''}${!privateLetter ? ` · ${row.rating ?? '未评分'}/5 · ${row.sealed_at ? '已封好' : '仅评分'} · 通知：${escape(row.notification_status || '未发送')}` : ''}</small><p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(privateLetter ? row.content : row.message || '只留下了评分')}</p><small>${escape(row.id)}</small></article>`).join('') || '<p>还没有收到。</p>';
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiet Folk · 来信与反馈</title><link rel="stylesheet" href="/admin/style.css"></head><body><main style="margin:0 auto;max-width:1000px;padding:32px"><a href="/admin">返回访问统计</a><h1>来信与反馈</h1><p>仅在这个受保护的页面读取正文。私人信不会加入反馈通知。</p><h2>私人来信</h2>${cards(data.private_letters,true)}<h2>网站评分与反馈</h2>${cards(data.feedback,false)}</main></body></html>`;
}
