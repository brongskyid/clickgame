/* CLICK UPGRADE — semua angka balance. Ubah di sini, manual dalam game ikut. */
function fmt(n){ return n>=1e6 ? (n/1e6).toFixed(2)+'M' : n>=1e4 ? (n/1e3).toFixed(1)+'K' : (n<10 && n%1!==0) ? n.toFixed(1) : String(Math.floor(n)); }

// ====== KONFIG ======
const GAME_ID = 'clickgame';
const MAX = 25;
const GRADE = { A:{mult:2.5, label:'Grade A'}, B:{mult:1, label:'Grade B'} };
// success rate turun per tier level (opsi 3): makin tinggi makin deg-degan
const TIERS = [ {from:0, A:0.95, B:0.65, stone:0}, {from:10, A:0.85, B:0.50, stone:1}, {from:15, A:0.70, B:0.35, stone:1}, {from:20, A:0.55, B:0.25, stone:2} ];
const PITY = { after:3, step:0.10 };                                        // gagal beruntun >= after → +step per gagal berikutnya
const STONE = { pack:[3,5,10], skillMs:3, itemMs:{10:1,15:2,20:3,25:5}, perOk:10, finish:10, rebirth:5 }; // sumber 💎 Batu Suci
const tierOf = lvl => TIERS.filter(t=>lvl>=t.from).pop();
const INCOME_MULT = 2;                                                       // semua income x2 (hasil simulasi: ~25 mnt aktif)
const FEE = { drop:100, stay:300 };
const PRICE_TIER = lvl => lvl>=20?3 : lvl>=15?2 : 1;                       // pengali harga scroll di level tinggi
const scrollPrice = lvl => Math.round(25*Math.pow(1.40,lvl)) * PRICE_TIER(lvl); // simulasi: ~40 mnt aktif, ~75 mnt santai
const INS_PCT = 0.30;                                                        // asuransi = 30% harga scroll (min FEE.stay)
const MODES = { normal:{label:'NORMAL'}, ta:{label:'TIME ATTACK', ms:30*60*1000} };
const REBIRTH_BONUS = 0.25;                                                  // tiap rebirth: +25% semua income (Time Attack)
const SUSPENSE_MS = 700;
const COMBO_GAP = 450, COMBO_CAP = 100;
const PACK = [ {min:5,bonus:10}, {min:10,bonus:80}, {min:20,bonus:350} ];
const SK_MAX = 100, MS = 25;                                  // max level & jarak milestone
const msTier = lv => Math.floor(lv/MS);                       // 0..4
const SKILLS = [
  {key:'mine', name:'GOLD MINING', ic:'⛏️', base:10, growth:1.11,
    desc:'+1 gold/detik per Lv · milestone x2',
    val:lv=>lv*Math.pow(2,msTier(lv)),
    eff:lv=>`+${fmt(lv*Math.pow(2,msTier(lv)))}/dtk`,
    msTxt:t=>`x${Math.pow(2,t)}`},
  {key:'tap',  name:'TAP POWER',  ic:'👆', base:15, growth:1.11,
    desc:'+1% gold/tap per Lv · milestone +50%',
    val:lv=>1+lv*0.01+msTier(lv)*0.5,
    eff:lv=>`x${(1+lv*0.01+msTier(lv)*0.5).toFixed(2)} tap`,
    msTxt:t=>`+${t*50}%`},
  {key:'luck', name:'FORTUNE',    ic:'🍀', base:25, growth:1.12,
    desc:'+0.04% success per Lv · milestone +0.5%',
    val:lv=>lv*0.0004+msTier(lv)*0.005,
    eff:lv=>`+${((lv*0.0004+msTier(lv)*0.005)*100).toFixed(2)}% rate`,
    msTxt:t=>`+${(t*0.5).toFixed(1)}%`},
];
const bySk = key => SKILLS.find(k=>k.key===key);
const skPrice = (k,lv) => Math.round(k.base*Math.pow(k.growth,lv));   // harga dari lv ke lv+1
const ITEMS = [
  {key:'head',   name:'KEPALA', ic:'🪖', kind:'armor',  side:'L', u:lv=>`Luck +${(lv*0.16).toFixed(1)}%`},
  {key:'body',   name:'BAJU',   ic:'👕', kind:'armor',  side:'L', u:lv=>`Pasif x${(1+lv*0.02).toFixed(2)}`},
  {key:'pants',  name:'CELANA', ic:'👖', kind:'armor',  side:'L', u:lv=>`Scroll -${lv}%`},
  {key:'weapon', name:'WEAPON', ic:'⚔️', kind:'weapon', side:'R', u:lv=>`${fmt(1+lv*(lv+1)/2)} base/tap`},
  {key:'hands',  name:'TANGAN', ic:'🧤', kind:'armor',  side:'R', u:lv=>`Combo max ${100-lv*2}`},
  {key:'feet',   name:'KAKI',   ic:'👢', kind:'armor',  side:'R', u:lv=>`Tempa -${lv*2}%`},
];
const ARMORS = ITEMS.filter(i=>i.kind==='armor');
const TOTAL_LV = ITEMS.length*MAX;
const byKey = key => ITEMS.find(i=>i.key===key);
const SAVE_KEY = 'click-upgrade-v3', LB_KEY = 'click-upgrade-lb';

