/* Independent experimental simulator. BorderHelper is a behavioral reference, not copied code. */
(function(global){
'use strict';
const skill={
'戰必斷金':{kind:'command',effect:'disarm',chance:0.90,turns:3},
'反計之策':{kind:'command',effect:'silence',chance:1,turns:1},
'神兵天降':{kind:'command',effect:'vulnerability',amount:.24,turns:3},
'大賞三軍':{kind:'command',effect:'bonus',amount:.24,turns:3},
'避其鋒芒':{kind:'command',effect:'shield',amount:.24,turns:3},
'重整旗鼓':{kind:'command',effect:'healLate',amount:1.1,turns:8},
'桃園結義':{kind:'command',effect:'peach',amount:1.1,turns:8},
'步步為營':{kind:'passive',effect:'stackShield',amount:.07},
'不攻':{kind:'passive',effect:'magicBoost',amount:.23},
'先驅突擊':{kind:'command',effect:'doubleHit',turns:3},
'三軍之眾':{kind:'active',effect:'heal',chance:.35,power:1.5,prep:1},
'渾水摸魚':{kind:'active',effect:'confuse',chance:.3,prep:1},
'楚歌四起':{kind:'active',effect:'dot',chance:.5,prep:1,power:1.15},
'十面埋伏':{kind:'active',effect:'magic',chance:.4,prep:1,power:1.3},
'道行險阻':{kind:'active',effect:'magic',chance:.4,power:1.2},
'掎角之勢':{kind:'active',effect:'physical',chance:.4,power:1.2},
'兼弱攻昧':{kind:'active',effect:'physical',chance:.35,power:1.35},
'回馬':{kind:'passive',effect:'counter',power:.5},
'健卒不殆':{kind:'passive',effect:'counter',power:.35},
'壘實迎擊':{kind:'passive',effect:'guard',power:.35},
'大火':{kind:'active',effect:'dot',chance:.35,power:1.1},
'絕水遏敵':{kind:'active',effect:'magic',chance:.35,power:1.2},
'河內世澤':{kind:'active',effect:'magic',chance:.35,power:1.1},
'伐謀':{kind:'active',effect:'magic',chance:.45,power:1},
'妖術':{kind:'active',effect:'confuse',chance:.3,prep:1},
'眾謀不懈':{kind:'command',effect:'magicBoost',amount:.18},
'始計':{kind:'command',effect:'shield',amount:.15,turns:4},
'攻其不備':{kind:'command',effect:'vulnerability',amount:.12,turns:8},
'長兵方陣':{kind:'command',effect:'bonus',amount:.1,turns:8}
};
function stats(name,position){
 // Deterministic identity-based proxy attributes, NOT game character stats.
 let h=2166136261;for(const ch of name){h=Math.imul(h^ch.codePointAt(0),16777619)>>>0;}
 return {attack:115+(h%57),defense:100+((h>>>7)%62),strategy:100+((h>>>14)%65),speed:65+((h>>>21)%45),position};
}
function simulate(team,op,r,verbose){
 const log=[],write=s=>{if(verbose)log.push(s)};
 const make=(x,i)=>({name:x.name,tactics:x.tactics||[],...stats(x.name,i),hp:10000,damage:0,healing:0,disarm:0,silence:0,confuse:0,dot:0,bonus:0,shield:0,vulnerability:0,boost:0,double:0,counter:0,prepared:[],side:0});
 const A=team.map((x,i)=>make(x,i)),B=op.g.map((name,i)=>make({name,tactics:op.t[i]},i));B.forEach(x=>x.side=1);
 const targets=(arr,range=3)=>arr.filter(x=>x.hp>0&&x.position<=range);
 const pick=arr=>arr[Math.floor(r()*arr.length)];
 function hurt(a,b,power,magic=false,label='普通攻擊'){
  const offensive=magic?a.strategy:a.attack,defensive=magic?b.strategy:b.defense;
  const ratio=Math.max(.25,offensive/(offensive+defensive*.72));
  const troop=.35+.65*Math.sqrt(a.hp/10000);
  const raw=1050*power*ratio*troop*(.92+r()*.16);
  const value=Math.max(1,Math.round(raw*(1+a.bonus+a.boost)*(1+b.vulnerability)*(1-b.shield)));
  b.hp=Math.max(0,b.hp-value);a.damage+=value;write((a.side?'敵':'我')+' '+a.name+' '+label+' → '+b.name+' -'+value+'（剩'+b.hp+'）');return value;
 }
 function heal(a,b,power,label){const v=Math.max(0,Math.min(10000-b.hp,Math.round(720*power*(.8+a.strategy/250))));b.hp+=v;a.healing+=v;write((a.side?'敵':'我')+' '+a.name+' '+label+' → '+b.name+' +'+v);}
 function apply(a,enemy,own,sk,round){
  const alive=targets(enemy),allies=targets(own);if(!alive.length||!allies.length)return;
  switch(sk.effect){
   case 'physical':hurt(a,pick(alive),sk.power,false,'戰法');break;
   case 'magic':hurt(a,pick(alive),sk.power,true,'策略戰法');break;
   case 'heal':heal(a,pick(allies.slice().sort((x,y)=>x.hp-y.hp).slice(0,2)),sk.power,'恢復');break;
   case 'dot':{const b=pick(alive);b.dot+=2;hurt(a,b,sk.power*.5,true,'持續傷害起效');break}
   case 'confuse':{let b=pick(alive);b.confuse=Math.max(b.confuse,2);write(a.name+' 使 '+b.name+' 混亂');break}
   case 'disarm':for(let j=0;j<Math.min(2,alive.length);j++)if(r()<sk.chance){let b=alive[j];b.disarm=Math.max(b.disarm,2);write(b.name+' 陷入怯戰');}break;
   case 'silence':for(const b of alive.slice(0,2)){b.silence=Math.max(b.silence,1);write(b.name+' 陷入猶豫')}break;
   case 'bonus':for(const b of allies.slice(0,2))b.bonus+=sk.amount;break;
   case 'vulnerability':for(const b of alive.slice(0,2))b.vulnerability+=sk.amount;break;
   case 'shield':for(const b of allies.slice(0,2))b.shield=Math.min(.65,b.shield+sk.amount);break;
   case 'stackShield':a.shield=Math.min(.6,a.shield+sk.amount);break;
   case 'magicBoost':a.boost+=sk.amount;break;
   case 'doubleHit':a.double=1;break;
   case 'counter':a.counter=Math.max(a.counter,sk.power);break;
   case 'guard':a.counter=Math.max(a.counter,sk.power);a.shield+=.1;break;
   case 'healLate':if(round>=5)heal(a,pick(allies.slice().sort((x,y)=>x.hp-y.hp).slice(0,2)),sk.amount,'重整旗鼓');break;
   case 'peach':if(round<=4)heal(a,pick(allies.slice().sort((x,y)=>x.hp-y.hp).slice(0,2)),sk.amount,'桃園結義');else hurt(a,pick(alive),sk.amount,true,'桃園結義');break;
  }
 }
 for(let round=1;round<=8;round++){
  write('【第 '+round+' 回合】');
  const live=[...A,...B].filter(x=>x.hp>0).sort((a,b)=>b.speed-a.speed||a.side-b.side);
  for(const u of live){
   if(u.hp<=0)continue;
   const own=u.side?B:A,enemy=u.side?A:B;
   if(!enemy.some(x=>x.hp>0))break;
   u.shield=Math.min(.75,u.shield);if(u.dot>0){let amount=Math.round(u.hp*.035);u.hp=Math.max(0,u.hp-amount);write(u.name+' 持續傷害 -'+amount);u.dot--;}
   if(u.hp<=0)continue;
   for(const name of u.tactics){
    const sk=skill[name];if(!sk)continue;
    if(sk.kind==='command'&&round===1&&!['healLate','peach','stackShield'].includes(sk.effect))apply(u,enemy,own,sk,round);
    else if(sk.kind==='command'&&['healLate','peach'].includes(sk.effect))apply(u,enemy,own,sk,round);
    else if(sk.kind==='passive'&&round===1)apply(u,enemy,own,sk,round);
    else if(sk.kind==='passive'&&sk.effect==='stackShield'&&round>1)apply(u,enemy,own,sk,round);
    else if(sk.kind==='active'&&u.silence===0){
     const waiting=u.prepared.find(x=>x.name===name);
     if(waiting){apply(u,enemy,own,sk,round);u.prepared=u.prepared.filter(x=>x!==waiting);}
     else if(r()<sk.chance){if(sk.prep){u.prepared.push({name});write(u.name+' 準備 '+name);}else apply(u,enemy,own,sk,round);}
    }
   }
   if(u.confuse>0){write(u.name+' 混亂，無法正常行動');u.confuse--;}
   else if(u.disarm>0){write(u.name+' 怯戰，無法普通攻擊');u.disarm--;}
   else {const valid=targets(enemy,3);if(valid.length){const n=u.double&&round<=3?2:1;for(let k=0;k<n;k++){const available=targets(enemy,3);if(!available.length)break;const victim=pick(available);hurt(u,victim,1,false,'普通攻擊');if(victim.hp>0&&victim.counter>0)hurt(victim,u,victim.counter,false,'反擊');}}}
   if(u.silence>0)u.silence--;
  }
  if(!A.some(x=>x.hp>0)||!B.some(x=>x.hp>0))break;
 }
 const ownHp=A.reduce((x,u)=>x+u.hp,0),enemyHp=B.reduce((x,u)=>x+u.hp,0);
 return {win:ownHp>enemyHp,draw:ownHp===enemyHp,ownHp,enemyHp,ownDamage:A.reduce((x,u)=>x+u.damage,0),enemyDamage:B.reduce((x,u)=>x+u.damage,0),rounds:8,units:A,enemyUnits:B,log};
}
global.BattleEngine={simulate,skill,version:'0.1-independent-experimental',warning:'非官方；屬性為代理值，計算與BorderHelper尚未對照驗證'};
})(window);