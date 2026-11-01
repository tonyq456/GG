// Run with: node stzb-pwa/battle-engine.test.js
const assert=require('node:assert/strict');
global.window={};
require('./battle-engine.js');
const engine=global.window.BattleEngine;
const near=(a,b)=>Math.abs(a-b)<1e-8;
assert.ok(near(engine.damageEstimate(150,150,10000),1080));
assert.ok(near(engine.damageEstimate(150,150,2500),540));
assert.ok(engine.damageEstimate(220,150,10000)>engine.damageEstimate(150,150,10000));
assert.ok(engine.damageEstimate(150,220,10000)<engine.damageEstimate(150,150,10000));
assert.ok(near(engine.damageEstimate(150,150,10000,2),2160));
assert.ok(near(engine.damageEstimate(150,150,0),0));
function rng(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
const team=[{name:'張角',tactics:['十面埋伏','不攻']},{name:'法正',tactics:['大賞三軍','神兵天降']},{name:'曹操',tactics:['戰必斷金','反計之策']}];
const enemy={g:['靈帝','孫權','呂蒙'],t:[['楚歌四起','十面埋伏'],['大賞三軍','神兵天降'],['反計之策','道行險阻']]};
const a=engine.simulate(team,enemy,rng(20261101),true),b=engine.simulate(team,enemy,rng(20261101),true);
assert.deepEqual(a,b,'Same seed produces identical result');
assert.ok(a.ownHp>=0&&a.ownHp<=30000);
assert.ok(a.enemyHp>=0&&a.enemyHp<=30000);
assert.ok(a.log.some(x=>x.includes('第 1 回合')));
console.log('Battle engine approximation tests passed');
