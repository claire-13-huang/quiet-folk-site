// A remembered browser identifies a return visit; an IP address is only a network clue.
export function requestIP(request) {
 const value=request.headers.get('CF-Connecting-IP')?.trim();
 if(!value||value.length>45)return null;
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(value))return value.split('.').every(part=>Number(part)<=255)?value.split('.').map(Number).join('.'):null;
 if(!value.includes(':')||value.includes('%'))return null;
 try {return new URL(`http://[${value}]/`).hostname.slice(1,-1)}catch{return null}
}
export function ipStatement(env,session,ip,now) {
 return env.DB.prepare(`INSERT INTO session_ips(session_id,ip,first_seen,last_seen,source) VALUES(?,?,?,?,'request')
 ON CONFLICT(session_id,ip) DO UPDATE SET first_seen=MIN(first_seen,excluded.first_seen),last_seen=MAX(last_seen,excluded.last_seen)`).bind(session,ip,now,now);
}
export async function describeVisitors(env,sessions) {
 if(!sessions.length)return [];
 const placeholders=sessions.map(()=>'?').join(',');
 const [labels,addresses]=await Promise.all([
  env.DB.prepare('SELECT visitor_id,origin,name FROM visitor_names').all(),
  env.DB.prepare(`SELECT session_id,ip,first_seen,last_seen,source FROM session_ips WHERE session_id IN (${placeholders}) ORDER BY first_seen`).bind(...sessions.map(s=>s.session_id)).all()
 ]);
 const known=addresses.results.length?await env.DB.prepare(`SELECT DISTINCT i.ip,n.name,n.visitor_id,n.origin FROM session_ips i JOIN sessions s USING(session_id) JOIN visitor_names n ON n.visitor_id=s.visitor_id AND n.origin=s.origin WHERE s.is_test=0 AND i.ip IN (SELECT ip FROM session_ips WHERE session_id IN (${placeholders}))`).bind(...sessions.map(s=>s.session_id)).all():{results:[]};
 return sessions.map(session=>{
  const label=session.is_test?null:labels.results.find(n=>n.visitor_id===session.visitor_id&&n.origin===session.origin);
  const ip_addresses=addresses.results.filter(row=>row.session_id===session.session_id);
  const matches=label||session.is_test?[]:known.results.filter(row=>row.origin===session.origin&&ip_addresses.some(address=>address.ip===row.ip));
  return {...session,display_name:label?.name||null,ip_addresses,ip_matches:[...new Set(matches.map(row=>row.name))]};
 });
}
