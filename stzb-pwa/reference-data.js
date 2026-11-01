/* Non-official reference metadata. Missing numeric values MUST remain null. */
(function(root){
const raw={
'戰必斷金':['指揮','控制','前3回合對敵軍群體施加怯戰；實際機率與版本相關','怯戰機率：參考90%；舊版資料45%','版本差異待核對'],
'反計之策':['指揮','控制／減益','限制敵方主動戰法並降低主動戰法傷害','首回合猶豫：部分版本100%；其餘數值待核對','版本差異待核對'],
'大賞三軍':['指揮','增益','前3回合提高我軍群體攻擊與策略攻擊傷害','參考基礎30%，受謀略影響','部分數值待核對'],
'神兵天降':['指揮','減益','前3回合提高敵軍受到的傷害','參考基礎30%，受謀略影響','部分數值待核對'],
'楚歌四起':['主動','策略／持續傷害','準備後對敵軍群體施加恐慌','參考發動率50%；恐慌傷害率127%，持續2回合','部分數值待核對'],
'十面埋伏':['主動','策略傷害／減益','準備後對敵軍全體造成策略傷害並附帶減益','參考發動率40%；策略傷害率130%','部分數值待核對'],
'重整旗鼓':['指揮','恢復','第5回合起持續恢復我軍兵力','參考恢復率140%，受謀略影響','部分數值待核對'],
'步步為營':['被動','減傷','自身受到的傷害逐回合降低','參考基礎減傷11%，每回合累積','部分數值待核對'],
'先驅突擊':['指揮','連擊／增益','前3回合先手並可進行兩次普通攻擊','參考攻擊屬性+30','部分數值待核對'],
'壘實迎擊':['被動','恢復／規避／援護','受普通攻擊時可恢復、淨化、規避，並具有援護效果','參考觸發50%；恢復率200%','版本差異待核對'],
'桃園結義':['指揮','恢復／策略傷害／援護','前4回合恢復；第5回合起攻擊敵軍；符合條件提供援護','參考恢復率160%、策略傷害率120%','版本差異待核對'],
'始計':['指揮','增益／減益／洞察','前期增減傷，受擊後獲得洞察','參考增傷20%、減傷30%；條件待核對','版本差異待核對'],
'攻其不備':['指揮','疊加易傷','敵方受到攻擊時疊加承傷效果','參考每層約11.6%，最多5層；受速度影響','版本差異待核對'],
'三軍之眾':['主動','恢復','準備後對我軍進行多次兵力恢復',null,'數值待核對'],
'不攻':['被動','增益／限制普攻','自身不能普通攻擊，提高策略傷害',null,'數值待核對'],
'眾謀不懈':['指揮','策略傷害','滿足條件時觸發策略攻擊',null,'數值待核對'],
'渾水摸魚':['主動','混亂','準備後使敵方陷入混亂','參考發動率25%～35%，不同版本有差異','版本差異待核對'],
'避其鋒芒':['指揮','減傷','前3回合降低我軍受到的傷害',null,'數值待核對'],
'道行險阻':['主動','策略傷害／減益','對敵軍造成策略傷害並施加減益',null,'數值待核對'],
'掎角之勢':['主動','傷害','對敵方造成傷害；傷害類型及細節待核對',null,'數值待核對'],
'妖術':['主動','混亂','對敵軍施加混亂效果',null,'數值待核對'],
'健卒不殆':['被動','反擊／減傷','提供減傷與反擊相關效果',null,'數值待核對'],
'兼弱攻昧':['主動','傷害','造成攻擊與策略相關傷害',null,'數值待核對'],
'河內世澤':['主動','策略傷害／控制','隨機觸發多組策略及控制效果',null,'數值待核對'],
'回馬':['被動','反擊','受到普通攻擊後反擊',null,'數值待核對'],
'絕水遏敵':['主動','策略傷害／禁療','策略傷害並限制敵方恢復',null,'數值待核對'],
'大火':['主動','策略／持續傷害','火攻及燃燒類效果',null,'數值待核對'],
'伐謀':['主動','策略／減益','造成策略相關效果及屬性減益',null,'數值待核對'],
'長兵方陣':['指揮','分兵','提供普通攻擊分兵效果',null,'數值待核對'],
'無':['無','無','不裝備戰法','—','不適用']
};
const tactics=Object.fromEntries(Object.entries(raw).map(([name,[type,effect,description,numbers,status]])=>[name,{type,effect,description,numbers,status,source:'https://www.jsoner.cn/gamehub/stzb/'}]));
const heroNames='夏侯惇XP,獻帝,十常侍,呂布,蔡文姬,貂蟬,袁紹,盧植,張角,董卓,賈詡,馬超,甄洛,劉備,諸葛亮,趙雲,張飛,曹操,荀彧,曹丕,關羽,張遼,王異,張春華,孫權,周瑜,周姬,孫堅,甘寧,呂蒙,孫尚香,何太后,王美人,皇甫嵩,朱儁,張奐,鮑信,董姬,嚴氏,法正,太史慈,靈帝,黃月英,陸遜,周泰,陸抗,祝融夫人,馬雲祿,郭嘉,張寧,張梁,司馬懿,龐統,姜維,黃忠,馬岱,馬良,魏延,曹純,張繡,木鹿大王,卞夫人,郝昭,張機,陳宮,沮授,公孫瓚,高順,張郃,許褚,典韋,徐晃,夏侯惇,夏侯淵,郭皇后,大喬,小喬,魯肅,程普,孫策,凌統,朱然,孫魯班,陳到,關銀屏,徐庶,馬謖,張任,顏良,文醜,田豐,華雄,李儒,華佗,于吉,左慈,張寶'.split(',');
const heroes=Object.fromEntries(heroNames.map(name=>[name,{level:40,attack:null,defense:null,strategy:null,speed:null,siege:null,source:null,status:'待核對'}]));
// Public historical reference cards. Distinguish same-name variants by faction and rarity.
const growthCards=[
{name:'曹操',variant:'魏·五星·騎',initial:{attack:80,defense:107,strategy:90,speed:88,siege:6},growth:{attack:1.28,defense:2.95,strategy:1.59,speed:1.26,siege:1.40},source:'https://www.juxia.com/sjwy/zixun-24638.html',status:'公開歷史資料，台服版本未核對'},
{name:'孫堅',variant:'吳·五星·騎',initial:{attack:89,defense:93,strategy:67,speed:86,siege:4},growth:{attack:1.29,defense:1.09,strategy:0.61,speed:1.13,siege:0.25},source:'https://kknews.cc/game/686yr3l.html',status:'2016年公開歷史資料，台服版本未核對'}
];
// Partial records: keep separately; never fabricate missing growth or initial stats.
const partialCards=[
{name:'曹操',variant:'漢·四星·騎',growth:{attack:.8,defense:.95,strategy:.83,speed:.9,siege:.11},source:'https://forum.gamer.com.tw/C.php?bsn=30108&snA=3341',status:'台灣玩家歷史攻略：僅成長值'},
{name:'孫堅',variant:'漢·四星·騎',growth:{attack:1.07,defense:.89,strategy:.47,speed:1,siege:.31},source:'https://forum.gamer.com.tw/C.php?bsn=30108&snA=3341',status:'台灣玩家歷史攻略：僅成長值'},
{name:'劉備',variant:'漢·四星·步',growth:{attack:.73,defense:.79,strategy:.62,speed:.39,siege:.97},source:'https://forum.gamer.com.tw/C.php?bsn=30108&snA=3341',status:'台灣玩家歷史攻略：僅成長值'},
{name:'司馬懿',variant:'漢·五星',growth:{attack:.76,defense:1.43,strategy:1.96,speed:.57,siege:.57},source:'https://forum.gamer.com.tw/C.php?bsn=30108&snA=3341',status:'台灣玩家歷史攻略：僅成長值'},
{name:'袁紹',variant:'漢·五星',growth:{attack:1.3,defense:1.63,strategy:1.05,speed:.57,siege:1.96},source:'https://forum.gamer.com.tw/Co.php?bsn=30108&sn=9684',status:'台灣玩家歷史攻略：僅成長值'},
{name:'靈帝',variant:'漢·五星',growth:{attack:1.48,defense:1.85,strategy:1.59,speed:.94,siege:1.12},source:'https://forum.gamer.com.tw/Co.php?bsn=30108&sn=9684',status:'台灣玩家歷史攻略：僅成長值'},
{name:'張遼',variant:'魏·五星·騎',initial:{attack:91,defense:94,strategy:83,speed:105,siege:3},source:'https://www.daisangoku.com/m/herolist/100027.html',status:'日本官方歷史圖鑑：僅初始值'},
{name:'徐庶',variant:'蜀·騎',initial:{attack:80,defense:82,strategy:97,speed:88,siege:4},source:'https://www.daisangoku.com/herolist/100067.html',status:'日本官方歷史圖鑑：僅初始值'},
{name:'張奐',variant:'漢·四星·步',initial:{attack:78,defense:79,strategy:88,speed:33,siege:20},source:'https://3g.d.cn/db/detail_shuaituzhibing_19052.html',status:'中國歷史圖鑑：僅初始值'},
{name:'孫策',variant:'吳·四星·騎',initial:{attack:95,defense:71,strategy:71,speed:76,siege:2},source:'https://3g.d.cn/db/detail_shuaituzhibing_19237.html',status:'中國歷史圖鑑：僅初始值'}
];
const cardCatalog=[...growthCards,...partialCards].map(card=>({...card,complete:!!(card.initial&&card.growth)}));
const calculateAtLevel=(card,level=40)=>Object.fromEntries(Object.keys(card.initial).map(key=>[key,Math.round((card.initial[key]+(level-1)*card.growth[key])*100)/100]));
for(const card of growthCards){if(heroes[card.name])heroes[card.name]={...heroes[card.name],...calculateAtLevel(card,40),variant:card.variant,initial:card.initial,growth:card.growth,source:card.source,status:card.status};}
root.STZBReference={heroes,tactics,growthCards,partialCards,cardCatalog,calculateAtLevel,notice:'武將40級實際屬性依卡片版本、星級、進階、配點、兵種與賽季可能不同；未取得可靠數據時不顯示假數值。戰法參考值非台服現行保證值。'};
})(window);
