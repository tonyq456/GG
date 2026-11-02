import{extract}from'./engine.mjs';
export const CWA_URL='https://www.cwa.gov.tw/V8/C/W/Town/Town.html?TID=1000723';
const plain=s=>s.replace(/<[^>]*>/g,'').trim();
const number=s=>/^[-+]?\d+(?:\.\d+)?%?$/.test(plain(s))?Number(plain(s).replace('%','')):null;
function taiwanDate(md,hm,now){const year=new Date(now+28800000).getUTCFullYear();const candidates=[year-1,year,year+1].map(y=>Date.parse(`${y}-${md.replace('/','-')}T${hm}:00+08:00`));return candidates.sort((a,b)=>Math.abs(a-now)-Math.abs(b-now))[0];}
export function parseCwa(gt,html,now=Date.now()){
 const stamp=gt.match(/var\s+GT_Time\s*=\s*\{\s*'C':'(\d{2}\/\d{2})<br>[^']*<br>(\d{2}:\d{2})'/),entry=gt.match(/'1000723'\s*:\s*\{([^{}]+)\}/);if(!stamp||!entry)throw Error('氣象署芳苑資料格式變更');
 const fields=Object.fromEntries([...entry[1].matchAll(/'([A-Za-z_]+)'\s*:\s*'([^']*)'/g)].map(m=>[m[1],m[2]]));const observed=taiwanDate(stamp[1],stamp[2],now)/1000;if(!Number.isFinite(observed)||now/1000-observed>7200||observed-now/1000>900)throw Error('氣象署即時資料已過期');
 const dates=Object.fromEntries([...html.matchAll(/id="(PC3_D\d+)"[^>]*>(\d{2}\/\d{2})/g)].map(m=>[m[1],m[2]]));
 const timeRow=html.match(/<tr class="time">([\s\S]*?)<\/tr>/)?.[1]||'';const time=[...timeRow.matchAll(/id="(PC3_D\d+H\d+)"\s+headers="PC3_Ti (PC3_D\d+)"[^>]*><span[^>]*>(\d{2}:\d{2})/g)].map(m=>taiwanDate(dates[m[2]],m[3],now)/1000);
 if(!time.length||time.some(t=>!Number.isFinite(t))||time.some((t,i)=>i&&t<=time[i-1])||time[0]>now/1000||time.at(-1)<=now/1000)throw Error('氣象署預報時段無效');
 const rows={},periods={};for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){const key=row[1].match(/<th[^>]*id="(PC3_[A-Za-z]+)"/)?.[1];if(!key)continue;const cells=[],ranges=[];for(const c of row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)){const span=Number(c[1].match(/colspan="(\d+)"/)?.[1]||1);if(span>50)throw Error('欄位異常');const start=cells.length;for(let i=0;i<span;i++){cells.push(c[2]);ranges.push({start:time[start],end:time[start+span]||time.at(-1)+10800});}}if(cells.length){rows[key]=cells;periods[key]=ranges;}}
 for(const k of ['PC3_T','PC3_MS','PC3_WD','PC3_Po'])if(rows[k]?.length!==time.length)throw Error('氣象署預報欄位不完整');
 const temp=rows.PC3_T.map(s=>number(s.match(/class="tem-C[^\"]*">([^<]*)/)?.[1]||''));
 const wind=rows.PC3_MS.map(number),rain=rows.PC3_Po.map(number);const directions={'北風':0,'東北風':45,'東風':90,'東南風':135,'南風':180,'西南風':225,'西風':270,'西北風':315};const dir=rows.PC3_WD.map(s=>directions[plain(s).replace('偏','')]??null);
 let i=time.findLastIndex(t=>t<=now/1000);const end=time[i+1]||time[i]+10800;const t=number(fields.C_T);if(t===null)throw Error('氣象署溫度缺值');
 return{current:{time:observed,temperature_2m:t,apparent_temperature:number(fields.C_AT),wind_speed_10m:wind[i],wind_direction_10m:dir[i],weather_code:null},hourly:{time,temperature_2m:temp,precipitation_probability:rain,wind_speed_10m:wind,wind_direction_10m:dir},coop:{source:'中央氣象署',town:'彰化縣芳苑鄉',townId:'1000723',url:CWA_URL,rain:rain[i],rainTime:periods.PC3_Po[i].start,rainEnd:periods.PC3_Po[i].end,windTime:periods.PC3_MS[i].start,windText:plain(rows.PC3_MS[i]).replace('&ge;','≥'),forecastNote:'風向、風速、降雨機率為鄉鎮時段預報；溫度為官網鄉鎮即時資料。'}};
}
let cached=null,pending=null;
export async function cwaWeather(fetcher=fetch,{full=false,now=Date.now()}={}){
 if(fetcher===fetch&&cached&&now-cached.at<300000)return full?cached.raw:extract(cached.raw,now);
 if(fetcher===fetch&&pending){const raw=await pending;return full?raw:extract(raw,now);}
 const task=(async()=>{const paths=['/Data/js/GT/TableData_GT_T_10007.js','/V8/C/W/Town/MOD/3hr/1000723_3hr_PC.html'];const data=await Promise.all(paths.map(async p=>{let last;for(let i=0;i<2;i++){try{const r=await fetcher('https://www.cwa.gov.tw'+p,{redirect:'manual',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('氣象署回應 HTTP '+r.status);const s=await r.text();if(s.length>1000000)throw Error('來源資料過大');return s;}catch(e){last=e;if(i===0)await new Promise(r=>setTimeout(r,1000));}}throw last;}));const raw=parseCwa(data[0],data[1],now);if(fetcher===fetch)cached={raw,at:now};return raw;})();
 if(fetcher===fetch)pending=task;try{const raw=await task;return full?raw:extract(raw,now);}finally{if(fetcher===fetch)pending=null;}
}
