import{validateConfig,ruleDecisions}from'./config.mjs';
import{defs,evaluate,extract,direction,finite}from'./engine.mjs';
import{sendPush,validateSubscription,pushSelfCheck}from'./push.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const names={...Object.fromEntries(defs.map(d=>[d.id,d.name])),direction:'迎風提醒'};
const format=v=>finite(v)?String(Math.round(v*10)/10):'缺值';
const stmt=(db,q,...args)=>db.prepare(q).bind(...args);
const run=(db,q,...args)=>stmt(db,q,...args).run();
async function readBody(request){if(Number(request.headers.get('Content-Length')||0)>65536)throw Error('資料過大');const t=await request.text();if(t.length>65536)throw Error('資料過大');return JSON.parse(t)}
async function queueEvent(db,user,kind,title,body,config,now=Date.now(),targetId=null){
 const id=crypto.randomUUID(),subs=(await stmt(db,'SELECT id FROM coop_subscriptions WHERE user_id=?'+(targetId?' AND id=?':''),...([user,...(targetId?[targetId]:[])])).all()).results;
 const payload=JSON.stringify({id,title,body,url:'/index.html',sound:config.sound,vibrate:config.vibrate,createdAt:now});
 const batch=[stmt(db,'INSERT INTO coop_events (id,user_id,kind,title,body,created_at,status) VALUES(?,?,?,?,?,?,?)',id,user,kind,title,body,now,subs.length?'queued':'no_subscription')];
 for(const sub of subs)batch.push(stmt(db,'INSERT INTO coop_outbox (id,event_id,subscription_id,payload,attempts,next_attempt,status) VALUES(?,?,?,?,0,?,?)',crypto.randomUUID(),id,sub.id,payload,now,'queued'));
 await db.batch(batch);return{id,devices:subs.length};
}
export async function flushOutbox(env,fetcher=fetch){
 const db=env.DB,now=Date.now();
 const jobs=(await stmt(db,"SELECT o.*,s.user_id,s.subscription FROM coop_outbox o JOIN coop_subscriptions s ON s.id=o.subscription_id WHERE o.status IN ('queued','retry') AND o.next_attempt<=? ORDER BY o.next_attempt LIMIT 25",now).all()).results;
 const totals={accepted:0,failed:0,expired:0};
 for(const job of jobs){
  let result;try{
   const payload=JSON.parse(job.payload);if(now-payload.createdAt>3600000){await run(db,"UPDATE coop_outbox SET status='expired',last_error='通知已超過一小時' WHERE id=?",job.id);totals.expired++;continue}
   result=await sendPush(JSON.parse(job.subscription),payload,env,fetcher);
  }catch(e){result={accepted:false,expired:false,status:0,error:/^推播(內容加密|簽章|服務連線)失敗（[A-Za-z]+Error）/.test(e?.message||'')?e.message:'推播資料或處理失敗'}}
  if(result.accepted){totals.accepted++;await db.batch([stmt(db,"UPDATE coop_outbox SET status='accepted',attempts=attempts+1,last_error=NULL WHERE id=?",job.id),stmt(db,'UPDATE coop_subscriptions SET last_accepted=?,last_error=NULL WHERE id=?',now,job.subscription_id)])}
  else{totals.failed++;const error=result.status?'推播服務回應 HTTP '+result.status:result.error||'推播連線或加密失敗';await db.batch([stmt(db,'UPDATE coop_outbox SET status=?,attempts=attempts+1,next_attempt=?,last_error=? WHERE id=?',result.expired?'expired':job.attempts>=2?'failed':'retry',now+300000,error,job.id),stmt(db,'UPDATE coop_subscriptions SET last_error=? WHERE id=?',error,job.subscription_id)]);if(result.expired){await run(db,'DELETE FROM coop_subscriptions WHERE id=?',job.subscription_id);await run(db,"UPDATE coop_outbox SET status='expired' WHERE subscription_id=? AND status IN ('queued','retry')",job.subscription_id)}}
 }
 await run(db,"UPDATE coop_events SET status=CASE WHEN EXISTS(SELECT 1 FROM coop_outbox o WHERE o.event_id=coop_events.id AND o.status='accepted') THEN 'accepted' WHEN EXISTS(SELECT 1 FROM coop_outbox o WHERE o.event_id=coop_events.id AND o.status IN ('queued','retry')) THEN 'queued' ELSE 'failed' END WHERE status='queued'");
 return totals;
}
async function weather(site,fetcher){const q=new URLSearchParams({latitude:site.lat,longitude:site.lon,current:'temperature_2m,wind_speed_10m,wind_direction_10m,apparent_temperature,weather_code',hourly:'precipitation_probability',timezone:'Asia/Taipei',timeformat:'unixtime',wind_speed_unit:'ms',forecast_days:'2'});const r=await fetcher('https://api.open-meteo.com/v1/forecast?'+q,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('氣象服務暫時無法使用');const v=extract(await r.json());if(!finite(v.time)||Date.now()/1000-v.time>7200)throw Error('氣象資料已過期');return v}
export async function monitor(env,{userId=null,force=false,fetcher=fetch}={}){
 const db=env.DB,now=Date.now();const lockKey='monitor',lease=crypto.randomUUID();
 const lock=await stmt(db,'INSERT INTO coop_runtime (id,value,lock_until) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,lock_until=excluded.lock_until WHERE coop_runtime.lock_until<? RETURNING id',lockKey,lease,now+300000,now).first();if(!lock)return{busy:true};
 let checked=0,errors=0;try{
 // Retire legacy saved humidity rules and queued messages without touching other thresholds.
 await run(db,"UPDATE coop_monitors SET config=json_remove(config,'$.rules.humidity','$.combo') WHERE json_type(config,'$.rules.humidity') IS NOT NULL OR json_type(config,'$.combo') IS NOT NULL");
 await run(db,"UPDATE coop_outbox SET status='cancelled' WHERE status IN ('queued','retry') AND event_id IN (SELECT id FROM coop_events WHERE title LIKE '%高濕%' OR body LIKE '%濕度%')");
 await run(db,"UPDATE coop_events SET status='cancelled' WHERE status='queued' AND (title LIKE '%高濕%' OR body LIKE '%濕度%')");
 const configs=(await stmt(db,'SELECT * FROM coop_monitors WHERE enabled=1'+(userId?' AND user_id=?':'')+' LIMIT 20',...(userId?[userId]:[])).all()).results;
 for(const row of configs){if(!force&&row.last_run&&now-row.last_run<3000000)continue;const c=validateConfig(JSON.parse(row.config)),observations=[];let lastError=null;
 for(const site of c.sites){try{
  const v=await weather(site,fetcher),results=evaluate(v,c),prefix=row.user_id+':'+site.id+':';const previous={};const saved=(await stmt(db,'SELECT * FROM coop_rule_states WHERE user_id=?',row.user_id).all()).results;for(const old of saved)if(old.id.startsWith(prefix))previous[old.id.slice(prefix.length)]=old;
  const decisions=ruleDecisions(results,previous,now,c.cooldown*60000,now<c.pauseUntil);
  const body=`${site.name}｜戶外 ${format(v.temp)}°C、${direction(v.direction)}風 ${format(v.wind)} m/s、下一小時降雨機率 ${format(v.rain)}%。`;
  const batches=decisions.changes.map(s=>stmt(db,'INSERT INTO coop_rule_states(id,user_id,active,last_queued) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active,last_queued=excluded.last_queued',prefix+s.key,row.user_id,s.active,s.last_queued));
  if(decisions.alerts.length)await queueEvent(db,row.user_id,'alert',decisions.alerts.map(k=>names[k]).join('、'),body,c,now);
  if(decisions.recoveries.length)await queueEvent(db,row.user_id,'recovery','恢復正常：'+decisions.recoveries.map(k=>names[k]).join('、'),site.name+'：最新資料已未達上述警戒門檻。',c,now);
  if(batches.length)await db.batch(batches);
  // Clear the outage state only after a successful weather fetch.
  await run(db,'DELETE FROM coop_rule_states WHERE id=?',prefix+'outage');observations.push({site:site.name,...v,alerts:decisions.alerts,unknown:Object.values(results).some(x=>x===null)});checked++;
 }catch{
  errors++;lastError='部分場區氣象資料無法更新，請確認現場狀況。';const key=row.user_id+':'+site.id+':outage',old=await stmt(db,'SELECT last_queued FROM coop_rule_states WHERE id=?',key).first();
  if(now>=c.pauseUntil&&(!old||now-old.last_queued>=21600000)){await queueEvent(db,row.user_id,'error','天氣資料中斷',site.name+'：無法取得新資料；舊數值不會解除警戒。',c,now);await run(db,'INSERT INTO coop_rule_states(id,user_id,active,last_queued) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET last_queued=excluded.last_queued',key,row.user_id,now)}
 }}await run(db,'UPDATE coop_monitors SET last_run=?,last_error=?,last_weather=? WHERE user_id=?',now,lastError,JSON.stringify(observations),row.user_id);
 }
 const delivery=await flushOutbox(env,fetcher);await run(db,"INSERT INTO coop_runtime(id,value,lock_until) VALUES('heartbeat',?,0) ON CONFLICT(id) DO UPDATE SET value=excluded.value",JSON.stringify({at:now,checked,errors,delivery}));
 // Bound private history retention and clean orphaned jobs.
 await run(db,'DELETE FROM coop_outbox WHERE event_id IN (SELECT id FROM coop_events WHERE created_at<?)',now-2592000000);await run(db,'DELETE FROM coop_events WHERE created_at<?',now-2592000000);
 return{checked,errors,delivery,at:now};
 }finally{await run(db,'UPDATE coop_runtime SET lock_until=0 WHERE id=? AND value=?',lockKey,lease)}
}
export async function route(request,env,ctx){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/coop/'))return null;
 if(!env.DB)return json({error:'伺服器資料庫尚未接通'},503);
 const user=request.headers.get('oai-authenticated-user-id'),path=url.pathname.slice('/api/coop/'.length),method=request.method;
 if(method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'不允許跨站請求'},403)}
 try{
 // This endpoint is protected by the owner-private Sites service-access boundary.
 if(path==='run'&&method==='POST')return json(await monitor(env,{userId:user||null}));
 if(path==='heartbeat'&&method==='GET'){const row=await stmt(env.DB,"SELECT value FROM coop_runtime WHERE id='heartbeat'").first();return json({heartbeat:row?JSON.parse(row.value):null})}
 if(path==='schedule'&&method==='POST'&&!user){const body=await readBody(request);if(typeof body.id!=='string'||body.id.length>200)throw Error('排程格式錯誤');await run(env.DB,"INSERT INTO coop_runtime(id,value,lock_until) VALUES('schedule',?,0) ON CONFLICT(id) DO UPDATE SET value=excluded.value",JSON.stringify({id:body.id,intervalMinutes:60,enabled:body.enabled===true,updatedAt:Date.now()}));return json({ok:true})}
 if(path==='push-retry'&&method==='POST'&&!user){const now=Date.now();await run(env.DB,"UPDATE coop_outbox SET next_attempt=? WHERE status IN ('queued','retry') AND id IN (SELECT o.id FROM coop_outbox o JOIN coop_events e ON e.id=o.event_id WHERE e.kind='test' AND e.created_at>? AND e.created_at=(SELECT MAX(e2.created_at) FROM coop_events e2 JOIN coop_outbox o2 ON o2.event_id=e2.id WHERE o2.subscription_id=o.subscription_id AND e2.kind='test'))",now,now-3600000);return json(await flushOutbox(env))}
 if(path==='diagnostics'&&method==='GET'&&!user){const cryptoCheck=await pushSelfCheck(env);const devices=(await stmt(env.DB,'SELECT last_accepted,last_error FROM coop_subscriptions LIMIT 10').all()).results;const events=(await stmt(env.DB,'SELECT kind,status,created_at FROM coop_events ORDER BY created_at DESC LIMIT 10').all()).results;let networkProbe;try{const r=await fetch('https://fcm.googleapis.com/',{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(5000)});networkProbe={status:r.status}}catch(e){networkProbe={error:String(e?.message||e?.name||'Error').replace(/https?:\/\/[^\s\"']+/g,'[服務網址]').slice(0,200)}}return json({cryptoCheck,networkProbe,devices,events})}
 if(!user)return json({error:'請登入後設定個人監測'},401);
 if(path==='status'&&method==='GET'){
  const row=await stmt(env.DB,'SELECT * FROM coop_monitors WHERE user_id=?',user).first();
  const devices=(await stmt(env.DB,'SELECT id,created_at,last_accepted,last_error FROM coop_subscriptions WHERE user_id=?',user).all()).results;
  const recent=(await stmt(env.DB,'SELECT id,kind,title,body,created_at,status FROM coop_events WHERE user_id=? ORDER BY created_at DESC LIMIT 100',user).all()).results;
  const schedule=await stmt(env.DB,"SELECT value FROM coop_runtime WHERE id='schedule'").first();
  const beat=await stmt(env.DB,"SELECT value FROM coop_runtime WHERE id='heartbeat'").first();
  return json({enabled:!!row?.enabled,config:row?validateConfig(JSON.parse(row.config)):null,lastRun:row?.last_run??null,error:row?.last_error??null,weather:row?.last_weather?JSON.parse(row.last_weather):[],devices,events:recent,schedule:schedule?JSON.parse(schedule.value):null,heartbeat:beat?JSON.parse(beat.value):null,pushReady:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_JWK),publicKey:env.VAPID_PUBLIC_KEY||null});
 }
 if(path==='config'&&method==='PUT'){const body=await readBody(request),config=validateConfig(body.config),now=Date.now();await run(env.DB,'INSERT INTO coop_monitors(user_id,config,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET config=excluded.config,enabled=excluded.enabled,updated_at=excluded.updated_at',user,JSON.stringify(config),body.enabled?1:0,now);if(!body.enabled||config.pauseUntil>now){await run(env.DB,"UPDATE coop_outbox SET status='cancelled' WHERE status IN ('queued','retry') AND event_id IN (SELECT id FROM coop_events WHERE user_id=? AND kind!='test')",user);await run(env.DB,"UPDATE coop_events SET status='cancelled' WHERE user_id=? AND status='queued' AND kind!='test'",user)}return json({ok:true})}
 if(path==='subscribe'&&method==='POST'){
  if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_JWK)return json({error:'伺服器推播金鑰尚未設定'},503);
  const sub=validateSubscription(await readBody(request));const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user+'\0'+sub.endpoint)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const count=await stmt(env.DB,'SELECT COUNT(*) n FROM coop_subscriptions WHERE user_id=?',user).first();if(count.n>=5&&!await stmt(env.DB,'SELECT id FROM coop_subscriptions WHERE id=?',id).first())throw Error('最多支援五部裝置');
  await run(env.DB,'INSERT INTO coop_subscriptions(id,user_id,subscription,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,last_error=NULL',id,user,JSON.stringify(sub),Date.now());return json({ok:true,id});
 }
 if(path==='unsubscribe'&&method==='POST'){const body=await readBody(request);if(!await stmt(env.DB,'SELECT id FROM coop_subscriptions WHERE user_id=? AND id=?',user,String(body.id||'')).first())return json({ok:true});await run(env.DB,'DELETE FROM coop_subscriptions WHERE user_id=? AND id=?',user,String(body.id||''));await run(env.DB,"UPDATE coop_outbox SET status='expired' WHERE subscription_id=? AND status IN ('queued','retry')",String(body.id||''));return json({ok:true})}
 if(path==='test'&&method==='POST'){
  const body=await readBody(request),sub=await stmt(env.DB,'SELECT id FROM coop_subscriptions WHERE user_id=? AND id=?',user,String(body.id||'')).first();if(!sub)throw Error('請先啟用此裝置的背景推播');
  const recent=await stmt(env.DB,"SELECT created_at FROM coop_events WHERE user_id=? AND kind='test' ORDER BY created_at DESC LIMIT 1",user).first();if(recent&&Date.now()-recent.created_at<30000)return json({error:'請等候 30 秒再測試'},429);
  const row=await stmt(env.DB,'SELECT config FROM coop_monitors WHERE user_id=?',user).first(),c=row?JSON.parse(row.config):{};
  const event=await queueEvent(env.DB,user,'test','晴舍背景推播測試','這則通知由伺服器發送。若已在手機通知列看到，即完成此裝置的接收測試。',c,Date.now(),sub.id);
  const delivery=await flushOutbox(env);return json({...event,delivery,note:'accepted 表示推播服務已接受，不代表手機已顯示。'});
 }
 if(path==='check'&&method==='POST')return json(await monitor(env,{userId:user,force:true}));
 return json({error:'找不到此操作'},404);
 }catch(e){return json({error:e instanceof Error?e.message:'操作失敗'},400)}
}
