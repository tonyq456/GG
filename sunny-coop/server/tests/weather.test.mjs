import test from 'node:test';
import assert from 'node:assert/strict';
import {weather} from '../lib/coop/weather.mjs';
const site={lat:23.924,lon:120.32};
const fresh=()=>Response.json({current:{time:Math.floor(Date.now()/1000),temperature_2m:29},hourly:{time:[Math.floor(Date.now()/1000)+3600],precipitation_probability:[10]}});
test('weather retries network and transient HTTP errors then returns fresh data',async()=>{let calls=0;const waits=[];const v=await weather(site,async()=>{calls++;if(calls===1)throw new TypeError('network');if(calls===2)return new Response('',{status:503});return fresh()},{wait:async ms=>waits.push(ms)});assert.equal(calls,3);assert.deepEqual(waits,[1000,3000]);assert.equal(v.temp,29)});
test('weather stops after three failures',async()=>{let calls=0;await assert.rejects(weather(site,async()=>{calls++;throw new Error('timeout')},{wait:async()=>{}}));assert.equal(calls,3)});
test('weather does not retry permanent HTTP errors or long Retry-After',async()=>{for(const [status,headers]of [[400,{}],[429,{'Retry-After':'60'}]]){let calls=0;await assert.rejects(weather(site,async()=>{calls++;return new Response('',{status,headers})},{wait:async()=>assert.fail('must not wait')}));assert.equal(calls,1)}});
test('weather respects short Retry-After and rejects stale data',async()=>{const waits=[];let calls=0;await weather(site,async()=>++calls===1?new Response('',{status:429,headers:{'Retry-After':'4'}}):fresh(),{wait:async ms=>waits.push(ms)});assert.deepEqual(waits,[4000]);calls=0;await assert.rejects(weather(site,async()=>{calls++;return Response.json({current:{time:1},hourly:{time:[],precipitation_probability:[]}})},{wait:async()=>{}}));assert.equal(calls,3)});

test('full forecast retains chart fields and bypasses cache',async()=>{const raw={current:{time:Math.floor(Date.now()/1000),temperature_2m:29},hourly:{time:[Math.floor(Date.now()/1000)+3600],temperature_2m:[30]},daily:{temperature_2m_max:[32]}};const v=await weather(site,async(url,options)=>{assert.equal(options.cache,'no-store');assert.ok(String(url).includes('daily='));return Response.json(raw)},{full:true});assert.deepEqual(v,raw)});
