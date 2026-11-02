import {extract,finite} from './engine.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// At most three requests; each attempt includes reading and validating the body.
export async function weather(site,fetcher=fetch,{wait=sleep,full=false}={}){
 const q=new URLSearchParams({latitude:site.lat,longitude:site.lon,current:'temperature_2m,wind_speed_10m,wind_direction_10m,apparent_temperature,weather_code',hourly:'precipitation_probability',timezone:'Asia/Taipei',timeformat:'unixtime',wind_speed_unit:'ms',forecast_days:'2'});
 if(full){q.set('hourly','temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m');q.set('daily','temperature_2m_max,temperature_2m_min');q.set('forecast_days','3');}
 for(let attempt=0;attempt<3;attempt++){
  let delay=[1000,3000][attempt],retry=true;
  try{
   const r=await fetcher('https://api.open-meteo.com/v1/forecast?'+q,{signal:AbortSignal.timeout(8000),redirect:'manual',cache:'no-store'});
   if(!r.ok){
    retry=[408,429,500,502,503,504].includes(r.status);
    const header=r.headers.get('Retry-After');
    if(header){const seconds=Number(header);const ms=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now();if(Number.isFinite(ms)){if(ms>5000)retry=false;else delay=Math.max(delay??0,ms,0);}}
    await r.body?.cancel();throw Error('氣象服務回應 HTTP '+r.status);
   }
   const raw=await r.json(),v=extract(raw);
   if(!finite(v.time)||Date.now()/1000-v.time>7200||v.time-Date.now()/1000>900)throw Error('氣象資料已過期或時間異常');
   return full?raw:v;
  }catch(e){if(!retry||attempt===2)throw e;await wait(delay);}
 }
}
