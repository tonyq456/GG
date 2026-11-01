import{defs,evaluate,finite}from'./engine.mjs';
const fields={high:['temp'],low:['temp'],wind:['wind'],rain:['rain'],direction:['wind','direction']};
const names={...Object.fromEntries(defs.map(d=>[d.id,d.name])),direction:'迎風提醒'};
export function alertView(values,config,fresh=true){const results=evaluate(values||{},config);return Object.fromEntries(['temp','wind','direction','rain'].map(field=>{const relevant=Object.keys(results).filter(k=>fields[k]?.includes(field)),hit=relevant.filter(k=>results[k]===true);return[field,{alert:fresh&&hit.length>0,unknown:!fresh||!finite(values?.[field])||relevant.some(k=>results[k]===null),reasons:fresh?hit.map(k=>names[k]):[]}]}))}
export function hourlyValues(hourly,index){return{temp:hourly.temperature_2m?.[index],wind:hourly.wind_speed_10m?.[index],direction:hourly.wind_direction_10m?.[index],rain:hourly.precipitation_probability?.[index]}}
