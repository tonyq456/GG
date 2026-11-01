import{state,save,toast,renderRules,renderWeather,renderSites}from'./app.js';
let cloud=null,deviceId=null,lastHash=null,syncTimer=null,busy=false;
const $=s=>document.querySelector(s),stamp=t=>t?new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'尚未執行';
const config=()=>({sites:state.sites,rules:state.rules,sector:state.sector,directionSpeed:state.directionSpeed,cooldown:state.cooldown,pauseUntil:state.pauseUntil,sound:state.sound,vibrate:state.vibrate});
async function api(path,method='GET',body){const r=await fetch('/api/coop/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',redirect:'error'});const d=await r.json();if(!r.ok)throw Error(d.error||'伺服器暫時無法連線');return d}
function render(){
 if(!cloud)return;const installed=!!deviceId&&cloud.devices.some(d=>d.id===deviceId),schedule=cloud.schedule?.enabled,late=!cloud.heartbeat||Date.now()-cloud.heartbeat.at>90*60000;
 window.coopBackgroundActive=cloud.enabled&&installed&&schedule&&!late;
 $('#cloudState').textContent=!cloud.pushReady?'推播服務尚未就緒':!schedule?'伺服器已接通，排程尚未啟用':!cloud.enabled?'尚未啟用背景監測':!installed?'背景監測已開啟，此裝置尚未訂閱':late?'背景排程心跳逾時，請檢查':'背景監測已開啟';
 $('#cloudDetails').textContent=`背景檢查：每小時｜最後檢查：${stamp(cloud.lastRun)}｜排程心跳：${stamp(cloud.heartbeat?.at)}｜已訂閱 ${cloud.devices.length} 部裝置。`+(cloud.error?' '+cloud.error:'');
 const device=cloud.devices.find(d=>d.id===deviceId);$('#deviceState').textContent=device?`此裝置已訂閱｜推播服務最後接受：${stamp(device.last_accepted)}${device.last_error?'｜'+device.last_error:''}`:'此裝置尚未訂閱背景推播。';
 $('#backgroundNotice').textContent=cloud.enabled?`背景由伺服器每小時檢查，監測雲端已儲存的全部場區。手機須啟用背景推播才能收到通知；系統可能延遲送達。最後檢查：${stamp(cloud.lastRun)}。`:'啟用後，關閉網頁也由伺服器每小時檢查。請先到警戒設定按「啟用背景推播與監測」。';
 const snapshot=$('#widgetCloudSnapshot');snapshot.replaceChildren();const heading=document.createElement('b');heading.textContent='小工具共用的雲端快照';snapshot.append(heading);for(const site of cloud.config?.sites||[]){const matches=(cloud.weather||[]).filter(w=>w.siteId===site.id||(!w.siteId&&w.site===site.name&&(cloud.config.sites.filter(s=>s.name===site.name).length===1)));const v=matches.find(w=>w.lat===undefined||(w.lat===site.lat&&w.lon===site.lon)),line=document.createElement('p'),num=x=>typeof x==='number'&&Number.isFinite(x)?Math.round(x*10)/10:'—';const dirs=['北','東北','東','東南','南','西南','西','西北'];const dir=typeof v?.direction==='number'?dirs[Math.round(((v.direction%360)+360)%360/45)%8]:'—';line.textContent=site.name+'｜'+(v?`${num(v.temp)}°C · ${dir}風 ${num(v.wind)} m/s · 降雨 ${num(v.rain)}% · 資料 ${stamp(v.time*1000)}`:'尚無成功的伺服器資料，請按立即檢查');snapshot.append(line);}
 $('#cloudDisable').disabled=!cloud.enabled;$('#pushTest').disabled=!installed;$('#cloudUnsubscribe').disabled=!installed;$('#cloudLoad').disabled=!cloud.config;
 $('#cloudEvents').replaceChildren();for(const event of cloud.events.slice(0,20)){const div=document.createElement('div');div.className='log';const content=document.createElement('div'),b=document.createElement('b'),p=document.createElement('p');b.textContent=event.title;p.textContent=event.body;content.append(b,p);const time=document.createElement('time');const status={accepted:'推播服務已接受',queued:'等候發送',no_subscription:'無訂閱裝置',failed:'未成功發送',cancelled:'已取消'}[event.status]||event.status;time.textContent=stamp(event.created_at)+' · '+status;div.append(content,time);$('#cloudEvents').append(div)}if(!cloud.events.length)$('#cloudEvents').textContent='尚無伺服器通知紀錄。';
}
async function refresh(){try{cloud=await api('status');const registration=await navigator.serviceWorker?.ready,subscription=await registration?.pushManager?.getSubscription();if(subscription){/* Endpoint stays private; server chooses its identifier. */const local=localStorage.getItem('coop-push-device');deviceId=local&&cloud.devices.some(d=>d.id===local)?local:null;if(!deviceId){const d=await api('subscribe','POST',subscription.toJSON());deviceId=d.id;localStorage.setItem('coop-push-device',d.id)}}else deviceId=null;render()}catch(e){$('#cloudState').textContent='無法連線至背景監測服務';$('#cloudDetails').textContent=e.message;$('#backgroundNotice').textContent='背景服務狀態無法確認：'+e.message;window.coopBackgroundActive=false}}
async function sync(enabled=cloud?.enabled??false){const c=config();await api('config','PUT',{config:c,enabled});lastHash=JSON.stringify(c);await refresh()}
function task(fn){return async()=>{if(busy)return;busy=true;try{await fn()}catch(e){toast(e.message)}finally{busy=false}}}
$('#cloudEnable').onclick=task(async()=>{
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('請使用支援背景推播的 Android Chrome 開啟');
 if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw Error('需允許通知才能啟用背景推播');
 cloud=await api('status');if(!cloud.pushReady)throw Error('伺服器推播金鑰尚未設定');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub){const key=Uint8Array.from(atob(cloud.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key})}
 const d=await api('subscribe','POST',sub.toJSON());deviceId=d.id;localStorage.setItem('coop-push-device',d.id);await sync(true);await api('check','POST',{});await refresh();toast('此裝置已訂閱，背景監測已啟用；請再按伺服器測試推播確認接收。');
});
$('#cloudSave').onclick=task(async()=>{await sync();toast('場區與警戒設定已儲存至雲端')});
$('#cloudDisable').onclick=task(async()=>{await sync(false);toast('已停止伺服器監測；所有裝置不再收到新的氣象警報')});
$('#cloudRefresh').onclick=task(refresh);
$('#cloudCheck').onclick=task(async()=>{await api('check','POST',{});await refresh();toast(cloud.enabled?'伺服器檢查已完成':'尚未啟用背景監測，請先啟用')});
$('#pushTest').onclick=task(async()=>{const d=await api('test','POST',{id:deviceId});await refresh();toast(d.delivery.accepted?'推播服務已接受測試通知，請確認手機通知列。':'測試未送出：'+(cloud?.devices.find(x=>x.id===deviceId)?.last_error||'請稍後重試'))});
$('#cloudUnsubscribe').onclick=task(async()=>{await api('unsubscribe','POST',{id:deviceId});const reg=await navigator.serviceWorker.ready;await(await reg.pushManager.getSubscription())?.unsubscribe();deviceId=null;localStorage.removeItem('coop-push-device');await refresh();toast('已取消此裝置的推播訂閱')});
$('#cloudLoad').onclick=task(async()=>{if(!cloud?.config)return;Object.assign(state,cloud.config);if(!state.sites.some(s=>s.id===state.selected))state.selected=state.sites[0].id;lastHash=JSON.stringify(config());save();renderRules();renderSites();renderWeather();toast('已載入雲端場區與警戒設定；請更新天氣')});
window.addEventListener('coop:local-save',()=>{if(!cloud?.enabled||lastHash===null||lastHash===JSON.stringify(config()))return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync().catch(e=>toast('雲端設定未儲存：'+e.message)),1000)});
navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='coop:push')refresh()});
lastHash=JSON.stringify(config());refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
