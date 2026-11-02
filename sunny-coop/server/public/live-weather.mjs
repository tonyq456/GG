import {extract,finite} from './engine.mjs';
export function validateWeather(raw){const v=extract(raw);if(!finite(v.time)||Date.now()/1000-v.time>7200||v.time-Date.now()/1000>900)throw Error('來源資料已過期或時間異常');return raw;}
export async function loadWeather(site,fetcher=fetch){
 // A different network path: the phone talks to the public source directly.
 const direct=new URLSearchParams({latitude:site.lat,longitude:site.lon,current:'temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code',hourly:'temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m',daily:'temperature_2m_max,temperature_2m_min',wind_speed_unit:'ms',timezone:'Asia/Taipei',timeformat:'unixtime',forecast_days:'3'});
 try{const r=await fetcher('https://api.open-meteo.com/v1/forecast?'+direct,{signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});if(!r.ok)throw Error('來源 HTTP '+r.status);return{raw:validateWeather(await r.json()),via:'手機直接查詢'};}catch{}
 const q=new URLSearchParams({lat:site.lat,lon:site.lon});const r=await fetcher('/api/coop/weather?'+q,{signal:AbortSignal.timeout(35000),cache:'no-store',redirect:'error'});if(!r.ok)throw Error('手機與伺服器皆未取得新資料（伺服器 HTTP '+r.status+'）');return{raw:validateWeather(await r.json()),via:'伺服器查詢（備援）'};
}
