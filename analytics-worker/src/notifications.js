// Durable per-visit notifications. Recipient and API credentials stay in Worker secrets.
export function notificationStatements(env,session,event,now=Date.now()) {
 if (!['invitation_yes','food_choice','session_end'].includes(event)) return [];
 // These statements run after the event insert in the SAME D1 transaction.
 // EXISTS checks therefore also see concurrent YES / exit requests once committed.
 return [
  env.DB.prepare("INSERT OR IGNORE INTO email_notifications(session_id,kind,next_attempt) SELECT ?,'accepted',? WHERE EXISTS(SELECT 1 FROM events WHERE session_id=? AND event='invitation_yes')").bind(session,now,session),
  env.DB.prepare("INSERT OR IGNORE INTO email_notifications(session_id,kind,next_attempt) SELECT ?,'summary',? WHERE EXISTS(SELECT 1 FROM events WHERE session_id=? AND event='invitation_yes')").bind(session,now+600000,session),
  env.DB.prepare("UPDATE email_notifications SET next_attempt=MIN(next_attempt,?) WHERE session_id=? AND kind='summary' AND status='pending' AND payload IS NULL AND EXISTS(SELECT 1 FROM events WHERE session_id=? AND event IN ('food_choice','session_end'))").bind(now+30000,session,session)
 ];
}
async function message(env,row) {
 const session=await env.DB.prepare('SELECT origin,is_test FROM sessions WHERE session_id=?').bind(row.session_id).first();
 const {results:events}=await env.DB.prepare('SELECT event,timestamp,food FROM events WHERE session_id=? ORDER BY timestamp').bind(row.session_id).all();
 const yes=events.find(e=>e.event==='invitation_yes');
 const meeting=events.find(e=>e.event==='meeting_confirm'||e.event==='meeting_adjust');
 const food=events.find(e=>e.event==='food_choice');
 const time=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',dateStyle:'medium',timeStyle:'medium'}).format(new Date(yes.timestamp));
 const subject=session.is_test?'Quiet Folk：邮件接入测试':row.kind==='accepted'?'Quiet Folk：有访客接受了邀请':'Quiet Folk：这次访问的行程选择';
 const text=[
  session.is_test?'这是一封邮件接入测试，不代表真实访客接受。':'一位访客点击了接受邀请。每次访问独立通知，这不代表已确认访客身份。',
  `接受时间：${time}（香港时间）`,
  '行程日期：2026年10月22日',
  '地点：香港机场',
  `见面时间：${meeting?.event==='meeting_confirm'?'12:00 PM，访客已确认':meeting?.event==='meeting_adjust'?'访客选择另行商量，时间待确认':'访客尚未确认'}`,
  `餐食：${food?(food.food==='We can decide later'?'访客选择稍后一起决定':food.food):'尚未选择'}`,
  `来源：${session.origin}`,
  `访问编号：${row.session_id}`,
  row.kind==='accepted'?'完成选择后会另发汇总；若未继续，汇总将标明尚未选择。':'这是发送时已记录的选择。'
 ].join('\n');
 return JSON.stringify({from:env.RESEND_FROM_EMAIL,to:[env.NOTIFICATION_TO],subject,text});
}
export async function deliverNotifications(env,send=fetch,now=Date.now()) {
 if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.NOTIFICATION_TO) return {configured:false,sent:0};
 // Repair a notification-only write failure without replaying analytics or mailing test traffic.
 await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO email_notifications(session_id,kind,next_attempt) SELECT e.session_id,'accepted',? FROM events e JOIN sessions s USING(session_id) WHERE e.event='invitation_yes' AND s.is_test=0 AND NOT EXISTS(SELECT 1 FROM email_notifications n WHERE n.session_id=e.session_id AND n.kind='accepted') LIMIT 100").bind(now),
  env.DB.prepare("INSERT OR IGNORE INTO email_notifications(session_id,kind,next_attempt) SELECT e.session_id,'summary',CASE WHEN EXISTS(SELECT 1 FROM events f WHERE f.session_id=e.session_id AND f.event IN ('food_choice','session_end')) THEN ? ELSE e.timestamp+600000 END FROM events e JOIN sessions s USING(session_id) WHERE e.event='invitation_yes' AND s.is_test=0 AND NOT EXISTS(SELECT 1 FROM email_notifications n WHERE n.session_id=e.session_id AND n.kind='summary') LIMIT 100").bind(now+30000),
  env.DB.prepare("UPDATE email_notifications SET next_attempt=MIN(next_attempt,?) WHERE kind='summary' AND status='pending' AND payload IS NULL AND EXISTS(SELECT 1 FROM sessions s WHERE s.session_id=email_notifications.session_id AND s.is_test=0) AND EXISTS(SELECT 1 FROM events e WHERE e.session_id=email_notifications.session_id AND e.event IN ('food_choice','session_end'))").bind(now+30000)
 ]);
 const {results:rows}=await env.DB.prepare("SELECT n.*,s.is_test FROM email_notifications n JOIN sessions s USING(session_id) WHERE n.status='pending' AND n.next_attempt<=? ORDER BY n.next_attempt LIMIT 10").bind(now).all();
 let sent=0;
 for (const row of rows) {
  // A five-minute lease prevents overlapping cron runs from sending the same visit twice.
  const locked=await env.DB.prepare("UPDATE email_notifications SET next_attempt=? WHERE session_id=? AND kind=? AND status='pending' AND next_attempt<=? RETURNING session_id").bind(now+300000,row.session_id,row.kind,now).first();
  if (!locked) continue;
  try {
   const payload=row.payload||await message(env,row);
   if (!row.payload) await env.DB.prepare('UPDATE email_notifications SET payload=? WHERE session_id=? AND kind=?').bind(payload,row.session_id,row.kind).run();
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`quiet-folk/${row.session_id}/${row.kind}`},body:payload,signal:AbortSignal.timeout(15000)});
   if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
   const result=await response.json();
   if (!result.id) throw new Error('Resend response missing email ID');
   await env.DB.prepare("UPDATE email_notifications SET status='sent',provider_id=?,api_status=?,last_error=NULL WHERE session_id=? AND kind=?").bind(result.id,response.status,row.session_id,row.kind).run();
   sent++;
  } catch(error) {
   const attempts=row.attempts+1;
   await env.DB.prepare('UPDATE email_notifications SET attempts=?,status=?,next_attempt=?,last_error=? WHERE session_id=? AND kind=?').bind(attempts,attempts>=8||row.is_test?'failed':'pending',now+Math.min(3600000,60000*2**attempts),String(error.message).slice(0,160),row.session_id,row.kind).run();
  }
  // Resend permits two requests per second; keep sends below that limit.
  await new Promise(resolve=>setTimeout(resolve,550));
 }
 return {configured:true,sent};
}
