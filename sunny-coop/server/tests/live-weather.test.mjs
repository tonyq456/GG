import test from'node:test';import assert from'node:assert/strict';import{loadWeather}from'../public/live-weather.mjs';
const fresh=()=>({current:{time:Math.floor(Date.now()/1000),temperature_2m:30},hourly:{time:[Math.floor(Date.now()/1000)+3600]}});
test('website requests same-origin CWA endpoint and labels source',async()=>{const v=await loadWeather({lat:23.97,lon:120.35},async u=>{assert.ok(u.startsWith('/api/coop/weather?'));return Response.json(fresh())});assert.ok(v.via.includes('氣象署'));});
test('CWA failure is not silently replaced with Open-Meteo',async()=>{let count=0;await assert.rejects(loadWeather({lat:23,lon:120},async()=>{count++;return new Response('',{status:503})}));assert.equal(count,1)});
