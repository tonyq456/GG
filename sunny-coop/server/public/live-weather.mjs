import{extract,finite}from'./engine.mjs';
export function validateWeather(raw){const v=extract(raw);if(!finite(v.time)||Date.now()/1000-v.time>7200||v.time-Date.now()/1000>900)throw Error('氣象署資料時間異常');return raw;}
export async function loadWeather(site,fetcher=fetch){const q=new URLSearchParams({lat:site.lat,lon:site.lon});const r=await fetcher('/api/coop/weather?'+q,{signal:AbortSignal.timeout(55000),cache:'no-store',redirect:'error'});if(!r.ok)throw Error('氣象署資料暫時無法取得（HTTP '+r.status+'）');return{raw:validateWeather(await r.json()),via:'中央氣象署 · 彰化縣芳苑鄉'};}
