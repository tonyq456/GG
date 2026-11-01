import{defs}from'./engine.mjs';
export function validateConfig(c){
 if(!c||!Array.isArray(c.sites)||c.sites.length<1||c.sites.length>10)throw Error('請設定 1 至 10 個場區');
 const sites=c.sites.map(s=>{if(typeof s.id!=='string'||!s.id||s.id.length>80||typeof s.name!=='string'||!s.name.trim()||s.name.length>40||!Number.isFinite(s.lat)||!Number.isFinite(s.lon)||Math.abs(s.lat)>85||Math.abs(s.lon)>180)throw Error('場區格式錯誤');return{id:s.id,name:s.name.trim(),lat:s.lat,lon:s.lon}});
 if(new Set(sites.map(s=>s.id)).size!==sites.length)throw Error('場區代碼重複');
 const rules={};for(const d of defs){const r=c.rules?.[d.id];if(!r||typeof r.on!=='boolean'||!Number.isFinite(r.value)||r.value<d.min||r.value>d.max)throw Error('警戒門檻格式錯誤');rules[d.id]={on:r.on,value:r.value}}
 const sector=c.sector===''?'':String(c.sector);if(sector!==''&&![0,45,90,135,180,225,270,315].includes(Number(sector)))throw Error('風向格式錯誤');
 if(!Number.isFinite(c.directionSpeed)||c.directionSpeed<0||c.directionSpeed>150)throw Error('風速格式錯誤');
 if(![15,30,60].includes(Number(c.cooldown)))throw Error('提醒間隔格式錯誤');
 const pauseUntil=Number(c.pauseUntil)||0;if(pauseUntil>Date.now()+86400000||pauseUntil<0)throw Error('暫停時間不正確');
 return{sites,rules,sector,directionSpeed:c.directionSpeed,cooldown:Number(c.cooldown),pauseUntil,sound:!!c.sound,vibrate:!!c.vibrate};
}
export function ruleDecisions(results,previous,now,cooldown,paused){
 const alerts=[],recoveries=[],changes=[];for(const[key,active]of Object.entries(results)){if(active===null)continue;const old=previous[key]||{active:0,last_queued:0};let last=old.last_queued;if(active&&!paused&&(!old.active||!last||now-last>=cooldown)){alerts.push(key);last=now}if(!active&&old.active&&!paused)recoveries.push(key);changes.push({key,active:active?1:0,last_queued:last})}return{alerts,recoveries,changes};
}
