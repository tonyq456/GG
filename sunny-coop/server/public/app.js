import{loadWeather}from'./live-weather.mjs';
import{alertView,hourlyValues}from'./alert-view.mjs';
import{projectMercator,unprojectMercator}from'./map-geometry.mjs';
import{defs,finite,direction,evaluate,extract}from'./engine.mjs';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fallback={sites:[{id:'fangyuan',name:'芳苑一場',lat:23.924,lon:120.32}],selected:'fangyuan',rules:Object.fromEntries(defs.map(d=>[d.id,{on:false,value:d.value}])),sector:'',directionSpeed:8,sound:false,vibrate:false,systemNotify:false,cooldown:30,pauseUntil:0,logs:[],states:{}};
let state;try{state=JSON.parse(localStorage.getItem('sunny-coop-v1'))||structuredClone(fallback);if(!state.sites?.length||!state.rules)throw Error();}catch{state=structuredClone(fallback)}
state.rules=Object.fromEntries(defs.map(d=>[d.id,state.rules[d.id]||{on:false,value:d.value}]));delete state.combo;
let weatherVia="",data=null,values=null,received=0,chartKey='temperature_2m',requestId=0,ac=null,installPrompt=null,toastTimer,sw=null,chartFreshness=null;
const currentSite=()=>state.sites.find(s=>s.id===state.selected)||state.sites[0];
function save(){try{localStorage.setItem('sunny-coop-v1',JSON.stringify(state));window.dispatchEvent(new Event('coop:local-save'))}catch{toast('瀏覽器無法儲存設定，離開後可能遺失。')}}
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000)}
const dateText=(t,opt={})=>new Date(t).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,...opt});
function show(page){$$('.page').forEach(e=>e.hidden=e.id!==page);$$('.nav').forEach(e=>e.classList.toggle('active',e.dataset.page===page));$('#pageName').textContent=({overview:'氣象總覽',places:'我的場區',rules:'警戒設定',history:'警報紀錄'})[page];if(page==='places')requestAnimationFrame(renderMap);if(page==='history')renderLogs();window.scrollTo({top:0})}
$$('[data-page]').forEach(b=>b.onclick=()=>show(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
function renderSites(){$('#siteSelect').innerHTML=state.sites.map(s=>`<option value="${esc(s.id)}" ${s.id===state.selected?'selected':''}>${esc(s.name)}</option>`).join('');$('#placesList').innerHTML=state.sites.map(s=>`<div class="place-item"><b>${esc(s.name)}</b>${s.id===state.selected?' <span class="pill">目前監測</span>':''}<p>${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</p><button class="button secondary" data-select="${esc(s.id)}">查看天氣</button>${state.sites.length>1?`<button class="delete" data-delete="${esc(s.id)}">刪除</button>`:''}</div>`).join('');$$('[data-select]').forEach(b=>b.onclick=()=>{selectSite(b.dataset.select);show('overview')});$$('[data-delete]').forEach(b=>b.onclick=()=>{if(!confirm('刪除此場區？歷史紀錄仍會保留。'))return;state.sites=state.sites.filter(s=>s.id!==b.dataset.delete);if(state.selected===b.dataset.delete)selectSite(state.sites[0].id);else{save();renderSites()}})}
function selectSite(id){state.selected=id;save();data=null;values=null;received=0;$('#errorBanner').hidden=true;renderSites();renderWeather();fetchWeather()}
$('#siteSelect').onchange=e=>selectSite(e.target.value);
function renderRules(){$('#ruleRows').innerHTML=defs.map(d=>`<div class="rule-row"><div><b>${d.name}</b><p>${d.hint}</p></div><label class="inline-label"><input type="number" id="value-${d.id}" min="${d.min}" max="${d.max}" step="0.1" value="${state.rules[d.id].value}" required aria-label="${d.name}門檻"> ${d.unit}</label><label class="switch"><input id="on-${d.id}" type="checkbox" ${state.rules[d.id].on?'checked':''} aria-label="啟用${d.name}"><span></span></label></div>`).join('');['sound','vibrate','systemNotify'].forEach(k=>$('#'+k).checked=state[k]);$('#windSector').value=state.sector;$('#directionSpeed').value=state.directionSpeed;$('#cooldown').value=state.cooldown;$('#pauseState').textContent=state.pauseUntil>Date.now()?`已暫停至 ${dateText(state.pauseUntil)}`:'目前沒有暫停提醒';}
async function permission(){if(!('Notification'in window)){toast('此瀏覽器不支援系統通知');return false}if(Notification.permission==='default')await Notification.requestPermission();if(Notification.permission!=='granted'){toast('通知未獲允許，請至瀏覽器網站設定開啟');return false}return true}
function initAudio(){try{ac??=new(window.AudioContext||window.webkitAudioContext)();ac.resume()}catch{}}
async function notify(title,body,settings=state){toast(title+'：'+body);if(settings.sound&&ac){try{await ac.resume();for(let i=0;i<3;i++){const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.frequency.value=660;g.gain.value=.12;const at=ac.currentTime+i*.3;o.start(at);o.stop(at+.16)}}catch{}}if(settings.vibrate)navigator.vibrate?.([250,120,250]);if(settings.systemNotify&&'Notification'in window&&Notification.permission==='granted'){try{if(sw)await sw.showNotification(title,{body,icon:'icon-192.png',tag:'coop-alert'});else new Notification(title,{body})}catch{toast('系統通知無法顯示，請檢查網站權限')}}}
$('#systemNotify').onchange=async e=>{if(e.target.checked&&!await permission())e.target.checked=false};$('#sound').onchange=initAudio;
$('#rulesForm').onsubmit=async e=>{e.preventDefault();initAudio();for(const d of defs)state.rules[d.id]={on:$('#on-'+d.id).checked,value:Number($('#value-'+d.id).value)};for(const k of['sound','vibrate','systemNotify'])state[k]=$('#'+k).checked;state.sector=$('#windSector').value;state.directionSpeed=Number($('#directionSpeed').value);state.cooldown=Number($('#cooldown').value);state.pauseUntil=Date.now()+Number($('#pause').value)*60000;state.states={};if(state.systemNotify&&!await permission())state.systemNotify=false;save();renderRules();renderWeather();if(values&&Date.now()-received<1800000)checkRules();toast('設定已儲存，套用至目前及其他場區。')};
$('#testBtn').onclick=async()=>{initAudio();const opts={sound:$('#sound').checked,vibrate:$('#vibrate').checked,systemNotify:$('#systemNotify').checked};if(opts.systemNotify&&!await permission())opts.systemNotify=false;await notify('晴舍測試提醒','這是測試，並非實際天氣警報。',opts);addLog('test','測試提醒','這是測試，並非實際天氣警報。')};
function addLog(type,title,body){state.logs.unshift({type,title,body,site:currentSite().name,time:Date.now()});state.logs=state.logs.slice(0,200);save();renderLogs()}
function checkRules(){if(window.coopBackgroundActive)return;if(!values||Date.now()-received>1800000)return;const result=evaluate(values,state),prefix=state.selected+':',titles={...Object.fromEntries(defs.map(d=>[d.id,d.name])),direction:'迎風提醒'};for(const[id,on]of Object.entries(result)){if(on===null)continue;const key=prefix+id,prev=state.states[key]||{active:false,last:0};if(on&&Date.now()>=state.pauseUntil&&(!prev.active||Date.now()-prev.last>=state.cooldown*60000)){const body=`${currentSite().name}｜戶外 ${fmt(values.temp)}°C、${direction(values.direction)}風 ${fmt(values.wind)} m/s、${dateText(values.rainTime*1000)} 降雨機率 ${fmt(values.rain)}%。`;addLog('alert',titles[id],body);notify(titles[id],body);prev.last=Date.now();prev.active=true;}else if(!on&&prev.active){addLog('recovery',titles[id]+'已恢復','最新資料已未達此規則的警戒門檻。');if(Date.now()>=state.pauseUntil)notify('恢復正常',currentSite().name+'：'+titles[id]+'已恢復');prev.active=false;prev.last=0}state.states[key]=prev}save();renderStatus()}
function weatherFresh(){return !!values&&received>0&&Date.now()-received<=1800000&&Date.now()/1000-values.time<=7200}
function renderAlertColors(){
 const view=alertView(values,state,weatherFresh()),hero=$('.hero-main');hero.classList.toggle('is-alert',view.temp.alert);hero.classList.toggle('is-unknown',view.temp.unknown);
 $('#heroTemp').setAttribute('aria-label',view.temp.alert?fmt(values?.temp,1)+'度，'+view.temp.reasons.join('、'):fmt(values?.temp,1)+'度');
 let reason=hero.querySelector('.alert-detail');if(!reason){reason=document.createElement('p');reason.className='alert-detail';hero.querySelector('.hero-body>div').append(reason)}reason.textContent=view.temp.reasons.join('、');reason.hidden=!view.temp.alert;
 $$('.metric').forEach((card,i)=>{const v=view[['wind','direction','rain'][i]];card.classList.toggle('is-alert',v.alert);card.classList.toggle('is-unknown',v.unknown);let detail=card.querySelector('.alert-detail');if(!detail){detail=document.createElement('p');detail.className='alert-detail';card.append(detail)}detail.textContent=v.reasons.join('、');detail.hidden=!v.alert});
 $('.status-panel').classList.toggle('is-alert',Object.values(view).some(v=>v.alert));
}
function renderStatus(){renderAlertColors();const fresh=weatherFresh();if(chartFreshness!==fresh){chartFreshness=fresh;renderChart()}const count=Object.values(state.rules).filter(r=>r.on).length+Number(state.sector!=='');$('#enabledCount').textContent=count+' 項';if(!values){$('#statusTitle').textContent='等待資料';$('#statusDetail').textContent='取得新資料後，依已啟用規則判斷。';return}if(!received||Date.now()-received>1800000||Date.now()/1000-values.time>7200){$('#statusTitle').textContent='資料已過期';$('#statusDetail').textContent='請更新資料；舊資料不會觸發警戒或解除警報。';return}const results=Object.values(evaluate(values,state)),hit=results.filter(x=>x===true).length;$('#statusTitle').textContent=hit?`${hit} 項達到警戒`:count?'目前未達警戒':'尚未啟用警戒';$('#statusTitle').style.color=hit?'#a96535':'';$('#statusDetail').textContent=(hit?'請查看警戒設定，並確認雞舍現場狀況。':count?'依已啟用規則判斷；仍請留意舍內實況。':'至警戒設定調整門檻並啟用提醒。')+(results.includes(null)?' 部分資料缺失，無法判斷相關規則。':'')+(state.pauseUntil>Date.now()?' 提醒暫停中。':'')}
const fmt=(v,d=0)=>finite(v)?v.toFixed(d):'—';
function weatherName(code){if(code===0)return'晴朗';if(code<=3)return'晴到多雲';if(code<=48)return'霧';if(code<=67)return'有雨';if(code<=77)return'降雪';if(code<=82)return'陣雨';if(code<=86)return'陣雪';return finite(code)?'雷雨':'待更新'}
function renderWeather(){const s=currentSite();$('#locationLabel').textContent=s.name+' · 氣象署芳苑鄉';$('#heroTemp').textContent=fmt(values?.temp,1);$('#weatherLabel').textContent=values?'氣象署鄉鎮資料':'等待氣象署資料';$('#feelsLike').textContent=values?`體感溫度 ${fmt(values.feels,1)}°C · 氣象署鄉鎮資料`:'取得資料後顯示體感溫度';$('#todayRange').textContent=data?.daily?`今日 ${fmt(data.daily.temperature_2m_min?.[0],1)}° — ${fmt(data.daily.temperature_2m_max?.[0],1)}°`:'今日高低溫 —';$('#lastUpdate').textContent=received?`${weatherVia} · 擷取 ${dateText(received)} · 資料 ${dateText(values.time*1000)}（台灣）`:'尚未取得資料';const metrics=[['風速',values?.windText||fmt(values?.wind,1),'m/s','鄉鎮風速預報，非現場實測','≋'],['風向',direction(values?.direction),finite(values?.direction)?fmt(values.direction)+'°':'','風從此方向吹來','↗'],['降雨機率',fmt(values?.rain),'%',values?dateText(values.rainTime*1000)+'－'+dateText(values.rainEnd*1000)+' 預報':'氣象署時段預報','☂']];$('#metrics').innerHTML=metrics.map(([name,v,unit,note,icon])=>`<article class="metric"><div class="metric-top">${name}<span>${icon}</span></div><div class="metric-value">${v}<small>${unit}</small></div><p>${note}</p></article>`).join('');renderStatus();renderChart()}
async function fetchWeather(){const id=++requestId,s={...currentSite()};$('#refreshBtn').disabled=true;$('#refreshBtn').textContent='↻ 更新中…';try{const result=await loadWeather(s),json=result.raw,v=extract(json);if(id!==requestId)return;if(!finite(v.time)||Date.now()/1000-v.time>7200)throw Error('來源資料已過期');weatherVia=result.via;data=json;values=v;received=Date.now();$('#errorBanner').hidden=true;renderWeather();checkRules();}catch(e){if(id!==requestId)return;$('#errorBanner').hidden=false;$('#errorBanner').textContent='目前無法取得最新天氣。'+(e.message||'請稍後重試')+' 舊資料不會觸發警戒。';received=0;renderWeather();$('#lastUpdate').textContent=values?'更新失敗 · 畫面為舊資料 '+dateText(values.time*1000)+'（台灣）':'更新失敗 · 尚無氣象資料';if(!state.logs.some(l=>l.type==='error'&&l.site===s.name&&Date.now()-l.time<1800000)){addLog('error','天氣資料更新失敗','網路或資料來源無法使用，請手動重試。');if(Date.now()>=state.pauseUntil)notify('天氣資料中斷',s.name+'：暫時無法取得新資料，請手動確認。')}if(!values){$('#chart').textContent='資料尚未取得，請點選更新天氣。'}}finally{if(id===requestId){$('#refreshBtn').disabled=false;$('#refreshBtn').textContent='↻ 更新天氣'}}}
$('#refreshBtn').onclick=fetchWeather;window.addEventListener('online',fetchWeather);window.addEventListener('pageshow',e=>{if(e.persisted)fetchWeather()});
function renderChart(){
 const chart=$('#chart');if(!data||!values){chart.className='chart-empty';chart.textContent='尚未取得預報資料';return}
 const h=data.hourly,start=values.idx,rows=h.time.slice(start,start+24).map((t,i)=>({t,v:h[chartKey]?.[start+i],all:hourlyValues(h,start+i)})),valid=rows.filter(r=>finite(r.v));
 if(!valid.length){chart.className='chart-empty';chart.textContent='此時段沒有可用預報';return}
 const min=Math.min(...valid.map(r=>r.v)),max=Math.max(...valid.map(r=>r.v)),lo=min-2,range=Math.max(4,max-min+4),step=78,width=Math.max(400,rows.length*step+32),x=i=>48+i*step,y=v=>164-(v-lo)/range*100;
 const unit={temperature_2m:'°C',precipitation_probability:'%',wind_speed_10m:'m/s'}[chartKey],number=v=>String(Number(v.toFixed(1)));
 let path='',open=false;rows.forEach((r,i)=>{if(!finite(r.v)){open=false;return}path+=(open?'L':'M')+x(i)+','+y(r.v)+' ';open=true});
 const field={temperature_2m:'temp',precipitation_probability:'rain',wind_speed_10m:'wind'}[chartKey];
 const labels=rows.map((r,i)=>{
  const appearance=alertView(r.all,state,weatherFresh())[field],alert=appearance.alert;

  const time=new Date(r.t*1000).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',hour12:false});
  const day=new Date(r.t*1000).toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric'});
  return `<g class="${alert?'forecast-alert':appearance.unknown?'forecast-unknown':''}">${finite(r.v)?`<circle cx="${x(i)}" cy="${y(r.v)}" r="4" fill="#ffffff"><title>${dateText(r.t*1000)}：${number(r.v)} ${unit}${alert?'，預報達到警戒：'+appearance.reasons.join('、'):''}</title></circle><text class="chart-number" x="${x(i)}" y="${y(r.v)-13}" text-anchor="middle">${number(r.v)}${unit}</text>${alert?`<text class="chart-alert-note" x="${x(i)}" y="${y(r.v)-29}" text-anchor="middle">警戒</text>`:''}`:`<text class="chart-number" x="${x(i)}" y="96" text-anchor="middle">—</text>`}<text class="chart-hour" x="${x(i)}" y="199" text-anchor="middle">${time}</text><text class="chart-date" x="${x(i)}" y="219" text-anchor="middle">${day}</text></g>`;
 }).join('');
 chart.className='chart-wrap';chart.innerHTML=`<p class="chart-hint"><span class="legend-alert">● 紅色：已啟用規則達到警戒</span> · 白色：未觸發或未啟用 · 灰色：資料不足或過期。預報警戒不代表已發生；左右滑動查看。</p><div class="chart-scroll" tabindex="0" role="region" aria-label="每小時預報數值，可左右滑動"><svg viewBox="0 0 ${width} 228" style="width:${width}px" role="img" aria-label="未來24小時趨勢，最低${number(min)}${unit}最高${number(max)}${unit}">${[64,114,164].map(v=>`<line x1="16" y1="${v}" x2="${width-16}" y2="${v}" stroke="#404040" stroke-dasharray="3 5"/>`).join('')}<path d="${path}" fill="none" stroke="#eeeeee" stroke-width="2.5" stroke-linejoin="round"/>${labels}</svg></div><div class="chart-summary">最低 ${number(min)} ${unit} · 最高 ${number(max)} ${unit} · 台灣時間 · 共 ${rows.length} 小時預報</div>`;
}
$$('[data-chart]').forEach(b=>b.onclick=()=>{chartKey=b.dataset.chart;$$('[data-chart]').forEach(x=>x.classList.toggle('selected',x===b));renderChart()});
function renderLogs(){const filter=$('#historyFilter').value,logs=state.logs.filter(l=>filter==='all'||l.type===filter);$('#historyList').innerHTML=logs.length?logs.map(l=>`<div class="log ${esc(l.type)}"><span class="log-symbol">${l.type==='recovery'?'✓':l.type==='test'?'♧':'!'}</span><div><b>${esc(l.title)}</b><p>${esc(l.site)} · ${esc(l.body)}</p></div><time>${dateText(l.time)}</time></div>`).join(''):'<div class="empty">◷<br>這裡還沒有紀錄<br><small>啟用警戒或測試提醒後，紀錄會顯示在這裡。</small></div>'}
$('#historyFilter').onchange=renderLogs;$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state.logs,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='晴舍警報紀錄.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000)};
let center={lat:23.924,lon:120.32},zoom=12,drag=null;function project(lat,lon){return projectMercator(lat,lon,zoom)}function unproject(x,y){return unprojectMercator(x,y,zoom)}
function mapInputs(){$('#latitude').value=center.lat.toFixed(6);$('#longitude').value=center.lon.toFixed(6)}
const tileNodes=new Map();let mapFrame=0;
function renderMap(){
 const m=$('#map'),w=m.clientWidth,h=m.clientHeight;if(!w||!h)return;
 const p=project(center.lat,center.lon),left=p.x-w/2,top=p.y-h/2,n=2**zoom,needed=new Set(),layer=$('#tiles');
 layer.style.transform='';
 // Reuse loaded image nodes and preload a one-tile margin. Never clear the layer while panning.
 for(let x=Math.floor(left/256)-1;x<=Math.floor((left+w)/256)+1;x++)for(let y=Math.floor(top/256)-1;y<=Math.floor((top+h)/256)+1;y++){
  if(y<0||y>=n)continue;const key=zoom+':'+x+':'+y;needed.add(key);let img=tileNodes.get(key);
  if(!img){img=document.createElement('img');img.draggable=false;img.alt='';img.decoding='async';img.src=`https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/${zoom}/${y}/${((x%n)+n)%n}`;tileNodes.set(key,img);layer.append(img)}
  img.style.left=(x*256-left)+'px';img.style.top=(y*256-top)+'px';
 }
 for(const[key,img]of tileNodes)if(!needed.has(key)){img.remove();tileNodes.delete(key)}
}
const map=$('#map');
map.onpointerdown=e=>{
 if(e.target.closest('button,a')||drag||e.isPrimary===false||e.button>0)return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0,p:project(center.lat,center.lon),moved:false};map.setPointerCapture(e.pointerId);e.preventDefault();
};
map.onpointermove=e=>{
 if(!drag||drag.id!==e.pointerId)return;drag.dx=e.clientX-drag.x;drag.dy=e.clientY-drag.y;
 if(Math.abs(drag.dx)+Math.abs(drag.dy)>5)drag.moved=true;
 if(!mapFrame)mapFrame=requestAnimationFrame(()=>{mapFrame=0;if(drag)$('#tiles').style.transform=`translate3d(${drag.dx}px,${drag.dy}px,0)`});
};
function finishMapDrag(e,cancelled=false){
 if(!drag||drag.id!==e.pointerId)return;const gesture=drag;drag=null;if(mapFrame){cancelAnimationFrame(mapFrame);mapFrame=0}
 if(gesture.moved)center=unproject(gesture.p.x-gesture.dx,gesture.p.y-gesture.dy);
 else if(!cancelled){const r=map.getBoundingClientRect();center=unproject(gesture.p.x+e.clientX-r.left-r.width/2,gesture.p.y+e.clientY-r.top-r.height/2)}
 if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);mapInputs();renderMap();
}
map.onpointerup=e=>finishMapDrag(e);map.onpointercancel=e=>finishMapDrag(e,true);map.onlostpointercapture=e=>finishMapDrag(e,true);
$('#zoomIn').onclick=()=>{zoom=Math.min(18,zoom+1);renderMap()};$('#zoomOut').onclick=()=>{zoom=Math.max(3,zoom-1);renderMap()};new ResizeObserver(()=>{if(!drag)renderMap()}).observe(map);
['latitude','longitude'].forEach(id=>$('#'+id).onchange=()=>{if(!$('#latitude').checkValidity()||!$('#longitude').checkValidity())return;center={lat:Number($('#latitude').value),lon:Number($('#longitude').value)};renderMap()});$('#locateBtn').onclick=()=>{if(!navigator.geolocation)return toast('此瀏覽器不支援定位，請在地圖選點');navigator.geolocation.getCurrentPosition(p=>{center={lat:p.coords.latitude,lon:p.coords.longitude};zoom=14;mapInputs();renderMap();toast('已選取目前位置，請命名並儲存')},()=>toast('定位未成功，請開啟權限或直接選點'),{timeout:10000})};$('#placeForm').onsubmit=e=>{e.preventDefault();const name=$('#placeName').value.trim();if(!name)return toast('請輸入場區名稱');const s={id:crypto.randomUUID(),name,lat:Number($('#latitude').value),lon:Number($('#longitude').value)};state.sites.push(s);$('#placeName').value='';selectSite(s.id);toast('場區已新增');show('overview')};
let serviceWorkerIssue='';
const isInstalled=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function updateInstallState(){
 const installed=isInstalled();$('#installNativeBtn').hidden=installed||!installPrompt;
 $('#installStatus').textContent=installed?'晴舍目前正以獨立 App 模式開啟，無須重複安裝。':installPrompt?'瀏覽器已提供安裝選項，請按下方「安裝晴舍」。':'目前瀏覽器未提供自動安裝提示。可以使用 Chrome 選單建立桌面捷徑。';
 $('#installUrl').value=location.origin+'/index.html';
 $('#installDiagnostics').textContent='安全連線：'+(window.isSecureContext?'正常':'未啟用')+'｜背景服務：'+(!('serviceWorker'in navigator)?'此瀏覽器不支援':serviceWorkerIssue?'註冊失敗，請重新登入後重試':'檢查中…');
 if('serviceWorker'in navigator)navigator.serviceWorker.getRegistration().then(r=>{$('#installDiagnostics').textContent='安全連線：'+(window.isSecureContext?'正常':'未啟用')+'｜背景服務：'+(r?.active?'已就緒':r?'安裝中，請稍後再試':serviceWorkerIssue?'註冊失敗，請重新登入後重試':'尚未就緒，請重新整理')}).catch(()=>{});
}
async function nativeInstall(){
 if(!installPrompt)return updateInstallState();const prompt=installPrompt;installPrompt=null;
 try{await prompt.prompt();const choice=await prompt.userChoice;toast(choice.outcome==='accepted'?'已接受安裝請求，請確認桌面或應用程式列表。':'已取消安裝，可改用 Chrome 選單建立捷徑。')}catch{toast('瀏覽器未完成安裝。請用 Chrome 選單建立捷徑。')}finally{updateInstallState()}
}
async function openInstall(){updateInstallState();if(!$('#installDialog').open)$('#installDialog').showModal();if(installPrompt&&!isInstalled())await nativeInstall()}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;if($('#installDialog').open)updateInstallState()});
window.addEventListener('appinstalled',()=>{installPrompt=null;updateInstallState();toast('瀏覽器回報安裝完成，請查看手機桌面或應用程式列表。')});
$('#installBtn').onclick=openInstall;$('#installQuickBtn').onclick=openInstall;$('#installNativeBtn').onclick=nativeInstall;$('#closeInstall').onclick=()=>$('#installDialog').close();
$('#copyInstallUrl').onclick=async()=>{try{await navigator.clipboard.writeText($('#installUrl').value);toast('網址已複製，請貼到手機 Chrome 網址列。')}catch{$('#installUrl').focus();$('#installUrl').select();toast('請長按網址，選擇複製。')}};
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(r=>{sw=r;if($('#installDialog').open)updateInstallState()}).catch(e=>{serviceWorkerIssue=e.name||'註冊失敗';if($('#installDialog').open)updateInstallState()});
setInterval(()=>{$('#clock').textContent=dateText(Date.now(),{weekday:'short'});renderStatus()},60000);$('#clock').textContent=dateText(Date.now(),{weekday:'short'});setInterval(fetchWeather,600000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-received>600000)fetchWeather()});renderSites();renderRules();renderLogs();renderWeather();fetchWeather();

export{state,save,toast,renderRules,renderWeather,renderSites};
