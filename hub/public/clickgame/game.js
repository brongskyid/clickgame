/* CLICK UPGRADE — logika game. Angka balance ada di config.js, server di ../hub.js */
(function(){
  const fresh = () => ({ gold:0, lv:Object.fromEntries(ITEMS.map(i=>[i.key,0])), mode:'drop', sel:'weapon',
    taps:0, tries:0, ok:0, bad:0, streak:0, best:0, spent:0, playMs:0, started:false, finished:false, sound:true, packs:0, sk:Object.fromEntries(SKILLS.map(k=>[k.key,0])), tab:'ench', gmode:'normal', rebirths:0,
    stones:0, pity:{}, itemMs:{} });
  let S = fresh();
  try{ const raw=localStorage.getItem(SAVE_KEY); if(raw){ S=loadState(JSON.parse(raw)); } }catch(e){}
  let LB = []; try{ LB = JSON.parse(localStorage.getItem(LB_KEY)||'[]'); }catch(e){}
  function loadState(o){ const f=fresh(); const n=Object.assign(f,o); n.lv=Object.assign(f.lv,o.lv||{}); n.sk=Object.assign(f.sk,o.sk||{}); n.pity=o.pity||{}; n.itemMs=o.itemMs||{}; if(!byKey(n.sel)) n.sel='weapon'; return n; }

  const $ = id => document.getElementById(id);
  const mmss = ms => { const s=Math.floor(ms/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };

  // ====== ekonomi ======
  const rbMult  = () => 1 + REBIRTH_BONUS*S.rebirths;
  const perTapBase = () => (1 + S.lv.weapon*(S.lv.weapon+1)/2) * bySk('tap').val(S.sk.tap) * rbMult() * INCOME_MULT;
  const armorSec = lv => lv*(lv+1)/4;
  const minArmor = () => Math.min(...ARMORS.map(i=>S.lv[i.key]));
  const packTier = () => PACK.filter(p=>minArmor()>=p.min).length;
  const packBonus= () => PACK.slice(0,packTier()).reduce((a,p)=>a+p.bonus,0);
  const bodyMult = () => 1 + S.lv.body*0.02;
  const skillSec= () => bySk('mine').val(S.sk.mine);
  const perSec  = () => (ARMORS.reduce((a,i)=>a+armorSec(S.lv[i.key]),0) + packBonus() + skillSec()) * bodyMult() * rbMult() * INCOME_MULT;
  const skCostN = (k,n) => { let t=0; for(let i=0;i<n;i++) t+=skPrice(k,S.sk[k.key]+i); return t; };
  const skAfford = k => { let n=0,t=0; while(S.sk[k.key]+n<SK_MAX && t+skPrice(k,S.sk[k.key]+n)<=S.gold){ t+=skPrice(k,S.sk[k.key]+n); n++; } return n; };
  const sumLv   = () => ITEMS.reduce((a,i)=>a+S.lv[i.key],0);
  const pityBonus = key => Math.max(0,(S.pity[key]||0)-(PITY.after-1))*PITY.step;
  const rate    = (g,lvl,key) => Math.min(0.99, tierOf(lvl)[g] + S.lv.head*0.0016 + bySk('luck').val(S.sk.luck) + pityBonus(key));
  const stoneNeed = (g,lvl) => g==='A' ? tierOf(lvl).stone : 0;
  function addStones(n,why){ if(n<=0) return; S.stones+=n; log(`💎 +${n} Batu Suci · ${why}`,'warn'); toast(`💎 +${n} Batu Suci`); }
  const scrollCost = (lvl,g) => Math.round(scrollPrice(lvl)*GRADE[g].mult*(1-S.lv.pants*0.01));
  const feeOf   = (m,lvl,g) => { const f = m==='stay' ? Math.max(FEE.stay, Math.round(scrollCost(lvl,g)*INS_PCT)) : FEE.drop; return Math.round(f*(1-S.lv.feet*0.02)); };
  const cost = (lvl,g) => scrollCost(lvl,g) + feeOf(S.mode,lvl,g);
  const isTA = () => S.gmode==='ta';
  const taLeft = () => Math.max(0, MODES.ta.ms - S.playMs);
  const score = () => S.rebirths*TOTAL_LV + sumLv();
  const power = () => sumLv()*10;
  const tierCls = lv => lv>=MAX?'max':lv>=20?'t3':lv>=15?'t2':lv>=10?'t1':'';

  function save(){ S.savedAt=Date.now(); try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); localStorage.setItem(LB_KEY, JSON.stringify(LB)); }catch(e){} cloudSaveSoon(); }
  // ====== Hub (server) ======
  const hub = () => (window.Hub && Hub.user) ? Hub : null;
  let cloudT=null, cloudBusy=false;
  function cloudSaveSoon(ms){ if(!hub()) return; clearTimeout(cloudT); cloudT=setTimeout(()=>cloudSaveNow(), ms??5000); }
  async function cloudSaveNow(keepalive){ if(!hub()||cloudBusy) return; cloudBusy=true; clearTimeout(cloudT); try{ await Hub.save(GAME_ID, S, {keepalive:!!keepalive}); setCloud('on'); }catch(e){ setCloud(e.message==='offline'?'off':'on'); } finally{ cloudBusy=false; } }
  function setCloud(st){ const el=$('cloud'); if(!el) return; el.className='cloud '+st; el.title = st==='on'?'Tersimpan di server':'Server tidak terjangkau, tersimpan di perangkat'; }
  function renderUser(){
    const el=$('userbox'); if(!el) return;
    const u=hub()?Hub.user:null;
    el.innerHTML = u ? `<span class="cloud on" id="cloud" title="Tersimpan di server">☁</span><b>${esc(u.name)}</b>${u.guest?'<small>tamu</small>':''}<button id="btn-out">keluar</button>`
                     : `<button id="btn-in">🔑 Login</button>`;
    const bi=$('btn-in'), bo=$('btn-out');
    if(bi) bi.onclick=async()=>{ const u=await Hub.ui.login({title:'CLICK UPGRADE'}); if(u) await afterLogin(); };
    if(bo) bo.onclick=async()=>{ await cloudSaveNow(); await Hub.logout(); renderUser(); renderBoard(); toast('Keluar. Progres tetap di perangkat ini.'); };
  }
  async function afterLogin(){
    // gabungkan: ambil save server, pakai yang lebih baru
    try{
      const srv=await Hub.load(GAME_ID);
      if(srv && srv.data && (srv.data.savedAt||0) > (S.savedAt||0)){
        S=loadState(srv.data); $('logs').innerHTML=''; log('☁ Progres dimuat dari server.','warn');
        try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){}
      } else if(S.started || S.stones>0 || Object.values(S.sk).some(v=>v>0)) { await Hub.save(GAME_ID,S); log('☁ Progres perangkat ini diunggah ke server.','warn'); }
    }catch(e){}
    renderUser(); render(); renderBoard();
  }

  // ====== audio ======
  let AC=null;
  function beep(freq,dur,type,vol){
    if(!S.sound) return;
    try{ AC = AC || new (window.AudioContext||window.webkitAudioContext)();
      const o=AC.createOscillator(), g=AC.createGain(); o.type=type||'square'; o.frequency.value=freq; g.gain.value=vol||0.05;
      o.connect(g); g.connect(AC.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime+dur); o.stop(AC.currentTime+dur);
    }catch(e){}
  }
  const sfx = {
    tap:()=>beep(600+Math.min(combo,60)*8,0.05,'square',0.03),
    tick:()=>beep(300,0.06,'triangle',0.04),
    ok:()=>{beep(660,0.12,'triangle',0.08);setTimeout(()=>beep(880,0.15,'triangle',0.08),90);setTimeout(()=>beep(1320,0.25,'triangle',0.08),180);},
    bad:()=>{beep(180,0.3,'sawtooth',0.08);setTimeout(()=>beep(120,0.4,'sawtooth',0.08),120);},
    max:()=>{[523,659,784,1046,1318].forEach((f,i)=>setTimeout(()=>beep(f,0.3,'triangle',0.09),i*110));}
  };

  // ====== toast / log / confetti ======
  let toastT;
  function toast(msg,big){ const t=$('toast'); t.textContent=msg; t.className='toast show'+(big?' big':''); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),big?2000:1200); }
  function log(msg,cls){ const d=document.createElement('div'); d.textContent=msg; if(cls) d.className=cls; const box=$('logs'); box.prepend(d); while(box.children.length>30) box.lastChild.remove(); }
  const cv=$('confetti'), cx=cv.getContext('2d'); let parts=[];
  function resize(){cv.width=innerWidth;cv.height=innerHeight} resize(); addEventListener('resize',resize);
  function confetti(n,x,y){ const colors=['#f5c542','#4ade80','#60a5fa','#c084fc','#fb923c','#fff'];
    for(let i=0;i<n;i++) parts.push({x,y,vx:(Math.random()-.5)*14,vy:-Math.random()*12-4,g:.45,r:Math.random()*5+3,c:colors[i%colors.length],life:70+Math.random()*30,rot:Math.random()*6}); }
  (function animC(){ cx.clearRect(0,0,cv.width,cv.height); parts=parts.filter(p=>p.life>0);
    for(const p of parts){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.vx*=.98; p.life--; p.rot+=.2;
      cx.save(); cx.translate(p.x,p.y); cx.rotate(p.rot); cx.fillStyle=p.c; cx.globalAlpha=Math.min(1,p.life/30); cx.fillRect(-p.r,-p.r/2,p.r*2,p.r); cx.restore(); }
    requestAnimationFrame(animC); })();

  // ====== manual ======
  function buildManual(){
    const pct=x=>Math.round(x*100)+'%';
    const tierRows=TIERS.map((t,i)=>{ const to=TIERS[i+1]?TIERS[i+1].from-1:MAX-1; return `<tr><td>Tier ${i+1}</td><td>+${t.from} – +${to}</td><td class="r">${pct(t.A)}</td><td class="r">${pct(t.B)}</td><td class="r">${t.stone?'💎 '+t.stone:'–'}</td></tr>`; }).join('');
    const packRows=PACK.map((p,i)=>`<li>Semua armor <b>+${p.min}</b> → <b>+${p.bonus} gold/detik</b> dan 💎 ${STONE.pack[i]}</li>`).join('');
    const perLv={head:'+0.16% success rate per level',body:'+2% semua gold/detik per level',pants:'-1% harga scroll per level',hands:'combo penuh 2 tap lebih cepat per level',feet:'-2% biaya tempa & asuransi per level'};
    const armorRows=ARMORS.map(i=>`<li>${i.ic} <b>${i.name}</b>: ${perLv[i.key]} → <b>${i.u(MAX)}</b> di +${MAX}</li>`).join('');
    const skRows=SKILLS.map(k=>`<li>${k.ic} <b>${k.name}</b>: ${k.desc}. Harga naik ${Math.round((k.growth-1)*100)}% tiap level.</li>`).join('');
    const itemMs=Object.entries(STONE.itemMs).map(([m,n])=>`+${m} → 💎 ${n}`).join(', ');
    $('manual-body').innerHTML=`
    <section><h3>🎯 TUJUAN</h3>
      <p>Naikkan <b>Weapon</b> dan <b>5 armor</b> (Kepala, Baju, Celana, Tangan, Kaki) sampai <b class="hl">+${MAX}</b> semuanya, total ${TOTAL_LV} level. Secepat mungkin, sehemat mungkin.</p></section>

    <section><h3>💰 TAP & COMBO</h3>
      <p>Tap koin di tengah untuk dapat gold. <b>Weapon</b> menentukan gold per tap.</p>
      <ul><li>Tap cepat tanpa jeda (&lt;${COMBO_GAP} ms) membangun <b>COMBO</b>. Bonus naik sampai <b>x2</b> di combo ${COMBO_CAP}. Berhenti tap, combo hilang.</li>
      <li>Armor memberi <b>gold per detik</b> otomatis, jalan terus selama layar terbuka.</li></ul></section>

    <section><h3>⚔️ ENCHANT</h3>
      <p>Ketuk slot item, lalu pilih scroll di panel tempa:</p>
      <ul><li><b>Grade A</b>: peluang tinggi, harga ${GRADE.A.mult}x lipat Grade B, tier 2+ butuh 💎 Batu Suci.</li>
      <li><b>Grade B</b>: murah, peluang rendah, tanpa batu. Ini jalur judinya.</li></ul>
      <table><tr><th>Tier</th><th>Level</th><th class="r">Grade A</th><th class="r">Grade B</th><th class="r">Batu (A)</th></tr>${tierRows}</table>
      <p>Harga scroll naik tiap level, <b class="hl">x2 mulai +15 dan x3 mulai +20</b>. Luck dari Kepala dan skill Fortune ditambahkan di atas rate tier.</p>
      <p><b>Biaya tempa</b> dibayar tiap percobaan, di luar harga scroll:</p>
      <ul><li><b>Tanpa asuransi</b> (${FEE.drop} gold): gagal = <b class="hl">turun 1 level</b>.</li>
      <li><b>Asuransi</b> (${Math.round(INS_PCT*100)}% harga scroll, min ${FEE.stay}): gagal = stay level.</li></ul>
      <div class="tip">Tips: di tier 4, asuransi mahal tapi turun dari +24 ke +23 lebih mahal lagi. Hitung, jangan cuma berani.</div></section>

    <section><h3>🔥 PITY</h3>
      <p>Gagal <b>${PITY.after}x beruntun</b> di slot yang sama, rate naik <b>+${Math.round(PITY.step*100)}%</b> per kegagalan berikutnya sampai sukses. Reset saat sukses. Status pity tampil di panel tempa.</p></section>

    <section><h3>🛡️ EFEK ARMOR</h3>
      <p>Setiap armor memberi gold/detik, plus efek unik yang makin kuat tiap level:</p>
      <ul>${armorRows}</ul></section>

    <section><h3>🎁 LEVEL PACK</h3>
      <p>Bonus kalau <b>semua 5 armor</b> mencapai level tertentu (slot terendah yang dihitung):</p>
      <ul>${packRows}</ul></section>

    <section><h3>✨ SKILLS</h3>
      <p>Upgrade pasti berhasil, tanpa judi. Max Lv ${SK_MAX}, <b>milestone tiap ${MS} level</b> memberi lonjakan besar dan 💎 ${STONE.skillMs}.</p>
      <ul>${skRows}</ul></section>

    <section><h3>💎 BATU SUCI</h3>
      <p>Material untuk Grade A tier 2 ke atas. Hangus tiap percobaan, sukses atau gagal. <b>Tidak bisa dibeli</b> dengan gold dan <b>dibawa lintas run</b>.</p>
      <ul><li>Item tembus level: ${itemMs}</li><li>Level Pack 1/2/3: 💎 ${STONE.pack.join('/')}</li><li>Milestone skill: 💎 ${STONE.skillMs}</li><li>Tiap ${STONE.perOk} enchant sukses: 💎 1</li><li>Tamat run Normal: 💎 ${STONE.finish} · Rebirth: 💎 ${STONE.rebirth}</li></ul>
      <div class="tip">Batu tidak cukup untuk Grade A terus-menerus dalam satu run. Pilih slot mana yang pantas dapat batu, sisanya judi pakai Grade B.</div></section>

    <section><h3>🏁 MODE NORMAL vs ⏳ TIME ATTACK</h3>
      <p>Pilih sebelum tap pertama. Mode terkunci sampai reset.</p>
      <ul><li><b>NORMAL</b>: tamat saat semua +${MAX}. Dinilai dari <b>waktu</b> dan <b>gold yang dipakai</b>.</li>
      <li><b>TIME ATTACK</b>: ${MODES.ta.ms/60000} menit. Saat semua +${MAX}, tombol <b class="hl">REBIRTH</b> muncul: semua enchant kembali ke +0, skill dan gold tetap, semua income <b>+${Math.round(REBIRTH_BONUS*100)}%</b> permanen. Skor = rebirth × ${TOTAL_LV} + level saat ini.</li></ul>
      <p>Timer hanya berjalan saat layar game terbuka.</p></section>

    <section><h3>🏆 LEADERBOARD</h3>
      <p>Tiga papan: <b>Waktu</b> (tercepat), <b>Gold</b> (paling hemat), <b>TA</b> (skor Time Attack tertinggi). Tersimpan di perangkat ini.</p></section>

    <section><h3>💡 STRATEGI DASAR</h3>
      <ul><li>Awal: naikkan semua armor rata ke +5 untuk Level Pack 1, Gold Mining beberapa level, baru Weapon.</li>
      <li>Kepala (Luck) dan Fortune terasa paling besar di tier 3–4.</li>
      <li>Simpan batu untuk tier 4. Tier 2 masih aman dijudi dengan Grade B.</li>
      <li>Kaki menurunkan biaya tempa, termasuk asuransi. Jangan diremehkan.</li></ul></section>`;
  }
  function openManual(){ buildManual(); $('manual').classList.add('show'); }
  function closeManual(){ $('manual').classList.remove('show'); try{ localStorage.setItem('click-upgrade-manual','1'); }catch(e){} }
  $('manual-btn').onclick=openManual; $('manual-close').onclick=closeManual; $('manual-start').onclick=closeManual;

  // ====== build slot cards ======
  for(const i of ITEMS){
    const d=document.createElement('div'); d.className='sl'; d.id='sl-'+i.key;
    d.innerHTML=`<span class="ic">${i.ic}</span><div class="t">${i.name}</div><span class="lv" id="lv-${i.key}">+0</span><div class="u" id="su-${i.key}"></div><div class="bar"><i id="bar-${i.key}"></i></div>`;
    d.addEventListener('click',()=>{ S.sel=i.key; $('f-roll').textContent=''; $('f-roll').className='roll'; save(); render(); });
    $(i.side==='L'?'colL':'colR').appendChild(d);
  }

  // ====== build skill cards ======
  $('skills').innerHTML = SKILLS.map(k=>`
    <div class="skill" id="sk-${k.key}">
      <div class="h"><span class="ic">${k.ic}</span><div class="t">${k.name}<small>${k.desc}</small></div><div class="lv" id="sklv-${k.key}">Lv 0</div></div>
      <div class="bar"><i id="skbar-${k.key}"></i>${[1,2,3].map(t=>`<s style="left:${t*MS}%"></s>`).join('')}</div>
      <div class="eff"><span>Sekarang <b id="skeff-${k.key}"></b></span><span class="nx" id="sknx-${k.key}"></span></div>
      <div class="buys">
        <button class="btn" id="skb1-${k.key}">+1<small id="skc1-${k.key}"></small></button>
        <button class="btn" id="skb10-${k.key}">+10<small id="skc10-${k.key}"></small></button>
        <button class="btn mx" id="skbm-${k.key}">MAX<small id="skcm-${k.key}"></small></button>
      </div>
    </div>`).join('');

  // ====== render ======
  const busy={};
  function render(){
    $('gold').textContent=fmt(S.gold); $('stones').textContent=S.stones;
    $('perTap').textContent=fmt(perTapBase()*comboMult());
    $('tapv').textContent='+'+fmt(perTapBase()*comboMult());
    $('perSec').textContent=fmt(perSec());
    $('power').textContent=fmt(power());
    $('tlabel').textContent = isTA() ? '⏳' : '⏱';
    $('timer').textContent = isTA() ? mmss(taLeft()) : mmss(S.playMs);
    $('timer').classList.toggle('warn', isTA() && S.started && !S.finished && taLeft()<60000);
    $('rb').textContent = S.rebirths ? `🔁 x${rbMult().toFixed(2)} ` : '';
    $('gm-normal').className = (S.gmode==='normal'?'on':'')+(S.started?' lock':'');
    $('gm-ta').className = (S.gmode==='ta'?'on ta':'')+(S.started?' lock':'');
    const canRb = isTA() && !S.finished && sumLv()>=TOTAL_LV;
    $('rebirth').classList.toggle('on',canRb);
    if(canRb) $('rb-desc').textContent=`Rebirth #${S.rebirths+1}: semua enchant balik ke +0, skill tetap, income x${(1+REBIRTH_BONUS*(S.rebirths+1)).toFixed(2)} permanen. Skor +${TOTAL_LV}.`;
    $('spent').textContent=fmt(S.spent);
    $('prog').textContent=sumLv()+'/'+TOTAL_LV;
    for(const i of ITEMS){
      const lv=S.lv[i.key];
      $('lv-'+i.key).textContent = '+'+lv;
      $('lv-'+i.key).className='lv '+tierCls(lv);
      $('su-'+i.key).textContent=i.u(lv);
      $('bar-'+i.key).style.width=(lv/MAX*100)+'%';
      $('sl-'+i.key).classList.toggle('sel',S.sel===i.key);
    }
    // forge panel
    const it=byKey(S.sel), lv=S.lv[it.key];
    $('f-ic').textContent=it.ic; $('f-name').textContent=it.name;
    const ti=TIERS.indexOf(tierOf(lv)), tNext=TIERS[ti+1];
    $('f-sub').textContent = (it.kind==='weapon' ? it.u(lv) : `${it.u(lv)} · ${fmt(armorSec(lv))}/dtk`)
      + (lv<MAX ? ` · Tier ${ti+1}` + (tNext?` (rate turun di +${tNext.from})`:' · tier tertinggi') : '')
      + (PRICE_TIER(lv)>1&&lv<MAX?` · harga x${PRICE_TIER(lv)}`:'');
    $('f-lv').textContent = lv>=MAX ? 'MAX +'+MAX : `+${lv} → +${lv+1}`;
    $('f-lv').className='lv'+(lv>=MAX?' max':'');
    $('f-bar').style.width=(lv/MAX*100)+'%';
    for(const g of ['A','B']){
      const b=$('btn-'+g);
      if(lv>=MAX){ b.innerHTML='MAX LEVEL'; b.disabled=true; continue; }
      const c=cost(lv,g), r=Math.round(rate(g,lv,it.key)*1000)/10, st=stoneNeed(g,lv);
      b.innerHTML=`${GRADE[g].label} · ${r.toFixed(r%1?1:0)}%<small>💰 ${fmt(c)}${st?` <span class="st">· 💎 ${st}</span>`:''}</small>`;
      b.disabled = !!busy[it.key] || S.gold<c || S.stones<st;
    }
    $('mode-drop').querySelector('b').textContent='💰 '+feeOf('drop',lv,'A')+' · Tanpa asuransi';
    const fb=feeOf('stay',lv,'B'), fa=feeOf('stay',lv,'A');
    $('mode-stay').querySelector('b').textContent = lv>=MAX ? '💰 30% · Asuransi' : `💰 ${fb===fa?fmt(fa):fmt(fb)+'–'+fmt(fa)} · Asuransi`;
    $('mode-drop').classList.toggle('on',S.mode==='drop');
    $('mode-stay').classList.toggle('on',S.mode==='stay');
    const pf=S.pity[it.key]||0, pb=pityBonus(it.key);
    $('f-pity').textContent = lv>=MAX ? '' : pb>0 ? `🔥 PITY aktif: gagal ${pf}x beruntun → rate +${Math.round(pb*100)}%` : pf>0 ? `Gagal ${pf}x beruntun · pity mulai di ${PITY.after}x` : '';
    const mn=minArmor(), tier=packTier();
    $('packs').innerHTML=PACK.map((p,i)=>`<div class="pk ${i<tier?'on':''}"><b>+${p.bonus}/dtk</b><small>${i<tier?`all +${p.min} ✓`:`all +${p.min} · ${mn}/${p.min}`}</small></div>`).join('');
    // tabs
    $('tab-ench').classList.toggle('on',S.tab==='ench'); $('tab-skill').classList.toggle('on',S.tab==='skill');
    $('page-ench').classList.toggle('on',S.tab==='ench'); $('page-skill').classList.toggle('on',S.tab==='skill');
    // skills
    for(const k of SKILLS){
      const lv=S.sk[k.key], kmax=lv>=SK_MAX;
      $('sklv-'+k.key).textContent = kmax ? 'MAX' : `Lv ${lv}/${SK_MAX}`;
      $('sklv-'+k.key).className='lv'+(kmax?' max':'');
      $('skbar-'+k.key).style.width=(lv/SK_MAX*100)+'%';
      $('skeff-'+k.key).textContent=k.eff(lv);
      const nextMs=(msTier(lv)+1)*MS;
      $('sknx-'+k.key).textContent = kmax ? `milestone ${k.msTxt(4)} ✓` : `Lv ${nextMs}: ${k.msTxt(msTier(lv)+1)} (${nextMs-lv} lagi)`;
      const n10=Math.min(10,SK_MAX-lv), nmax=skAfford(k);
      $('skc1-'+k.key).textContent = kmax?'':'💰 '+fmt(skCostN(k,1));
      $('skc10-'+k.key).textContent = kmax?'':'💰 '+fmt(skCostN(k,n10));
      $('skcm-'+k.key).textContent = kmax?'':(nmax>0?`+${nmax} · ${fmt(skCostN(k,nmax))}`:'—');
      $('skb1-'+k.key).disabled = kmax || S.gold<skCostN(k,1);
      $('skb10-'+k.key).disabled = kmax || S.gold<skCostN(k,n10);
      $('skbm-'+k.key).disabled = kmax || nmax<1;
    }
    $('s-streak').textContent=S.streak; $('s-best').textContent=S.best;
    $('s-tries').textContent=S.tries; $('s-ok').textContent=S.ok; $('s-bad').textContent=S.bad;
    $('sound').textContent=S.sound?'🔊':'🔇';
  }

  // ====== tap + combo ======
  let combo=0, lastTap=0;
  const comboCap  = () => COMBO_CAP - S.lv.hands*2;
  const comboMult = () => 1 + Math.min(combo,comboCap())/comboCap();
  const tapEl=$('tap');
  tapEl.addEventListener('pointerdown', e=>{
    if(S.finished) return;
    const now=performance.now();
    combo = (now-lastTap<COMBO_GAP) ? combo+1 : 1; lastTap=now;
    if(!S.started){ S.started=true; log('⏱ Run dimulai!','warn'); }
    const g=Math.round(perTapBase()*comboMult()); S.gold+=g; S.taps++;
    const r=tapEl.getBoundingClientRect();
    const f=document.createElement('span'); f.className='float'; f.textContent='+'+fmt(g);
    f.style.left=(e.clientX-r.left)+'px'; f.style.top=(e.clientY-r.top-10)+'px';
    tapEl.appendChild(f); setTimeout(()=>f.remove(),700);
    $('combo').textContent = combo>=3 ? `COMBO x${combo} · bonus x${comboMult().toFixed(2)}` : ' ';
    sfx.tap(); render();
  });
  setInterval(()=>{ if(combo>0 && performance.now()-lastTap>COMBO_GAP){ combo=0; $('combo').textContent=' '; render(); } },150);

  // ====== enchant ======
  function enchant(g){
    const item=S.sel; if(S.finished||busy[item]) return;
    const lv=S.lv[item]; if(lv>=MAX) return;
    const c=cost(lv,g), st=stoneNeed(g,lv);
    if(S.gold<c){ toast('Gold kurang!'); return; }
    if(S.stones<st){ toast('💎 Batu Suci kurang! Pakai Grade B atau cari batu.'); return; }
    if(!S.started) S.started=true;
    S.gold-=c; S.spent+=c; S.tries++; S.stones-=st;
    const insured=S.mode==='stay', name=byKey(item).name;
    const card=$('sl-'+item), rollEl=$('f-roll');
    busy[item]=true; card.classList.add('busy'); rollEl.className='roll'; rollEl.textContent='Menempa…';
    render();
    let t=0; const tk=setInterval(()=>{ sfx.tick(); rollEl.textContent='Menempa'+'.'.repeat(1+(t++%3)); },170);
    setTimeout(()=>{
      clearInterval(tk); busy[item]=false; card.classList.remove('busy','flash-ok','flash-bad'); void card.offsetWidth;
      const roll=Math.floor(Math.random()*100)+1, need=Math.round(rate(g,lv,item)*100), success=roll<=need;
      const showRoll = S.sel===item;
      if(success){
        S.lv[item]++; S.ok++; S.streak++; S.best=Math.max(S.best,S.streak); S.pity[item]=0;
        for(const m of Object.keys(STONE.itemMs).map(Number)) if(S.lv[item]>=m && (S.itemMs[item]||0)<m){ S.itemMs[item]=m; addStones(STONE.itemMs[m],`${name} tembus +${m}`); }
        if(S.ok%STONE.perOk===0) addStones(1,`${S.ok} enchant sukses`);
        card.classList.add('flash-ok');
        if(showRoll){ rollEl.className='roll ok'; rollEl.textContent=`Roll ${roll} ≤ ${need} ✓  SUKSES`; }
        log(`✅ ${name} +${lv} → +${lv+1} (${GRADE[g].label}, roll ${roll})`,'ok');
        const r=card.getBoundingClientRect(); confetti(S.lv[item]>=20?60:25, r.left+r.width/2, r.top+r.height/2);
        if(S.lv[item]>=MAX){ sfx.max(); toast(`🏆 ${name} MAX +${MAX}!`,true); }
        else { sfx.ok(); toast(`SUCCESS! ${name} +${S.lv[item]}`+(S.streak>=3?`  🔥x${S.streak}`:'')); }
        if(packTier()>S.packs){
          S.packs=packTier(); const pt=S.packs, pk=PACK[pt-1]; addStones(STONE.pack[pt-1],`Level Pack ${pt}`);
          setTimeout(()=>{ sfx.max(); toast(`🎁 LEVEL PACK ${pt}: +${pk.bonus} gold/detik!`,true); confetti(120, innerWidth/2, innerHeight/3); },400);
          log(`🎁 Level Pack ${pt} aktif: all armor +${pk.min} → +${pk.bonus} gold/detik`,'warn');
        }
      }else{
        S.bad++; S.streak=0; S.pity[item]=(S.pity[item]||0)+1; card.classList.add('flash-bad'); sfx.bad();
        document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
        const near = roll-need<=3 ? '  nyaris!' : '';
        if(!insured && lv>0){
          S.lv[item]--;
          if(showRoll){ rollEl.className='roll bad'; rollEl.textContent=`Roll ${roll} > ${need} ✗  GAGAL, turun ke +${S.lv[item]}${near}`; }
          log(`❌ ${name} GAGAL +${lv} → +${lv-1} (${GRADE[g].label}, roll ${roll})`,'bad');
          toast(`FAILED! ${name} turun ke +${S.lv[item]}`);
        }else{
          if(showRoll){ rollEl.className='roll bad'; rollEl.textContent=`Roll ${roll} > ${need} ✗  GAGAL, stay +${lv}${near}`; }
          log(`⚠️ ${name} gagal, stay +${lv} (${GRADE[g].label}, roll ${roll})`,'warn');
          toast(`FAILED! ${name} stay +${lv}`);
        }
      }
      save(); render();
      if(sumLv()>=TOTAL_LV && !isTA()) finish();
    }, SUSPENSE_MS);
  }
  $('btn-A').addEventListener('click',()=>enchant('A'));
  $('btn-B').addEventListener('click',()=>enchant('B'));
  function buySkill(k,n){
    if(S.finished) return;
    n=Math.min(n,SK_MAX-S.sk[k.key]); if(n<1) return;
    const c=skCostN(k,n); if(S.gold<c){ toast('Gold kurang!'); return; }
    if(!S.started) S.started=true;
    const before=S.sk[k.key];
    S.gold-=c; S.spent+=c; S.sk[k.key]+=n;
    sfx.ok();
    log(`${k.ic} ${k.name} Lv ${before} → Lv ${S.sk[k.key]} (${k.eff(S.sk[k.key])}, 💰 ${fmt(c)})`,'ok');
    toast(`${k.ic} ${k.name} Lv ${S.sk[k.key]} · ${k.eff(S.sk[k.key])}`);
    if(msTier(S.sk[k.key])>msTier(before)){
      const t=msTier(S.sk[k.key]), card=$('sk-'+k.key); card.classList.remove('ms'); void card.offsetWidth; card.classList.add('ms');
      setTimeout(()=>{ sfx.max(); toast(`${k.ic} MILESTONE ${k.name} Lv ${t*MS}: ${k.msTxt(t)}!`,true); confetti(100, innerWidth/2, innerHeight/2); },300);
      log(`🌟 Milestone ${k.name} Lv ${t*MS}: ${k.msTxt(t)}`,'warn'); addStones(STONE.skillMs,`milestone ${k.name}`);
    }
    save(); render();
  }
  for(const k of SKILLS){
    $('skb1-'+k.key).onclick=()=>buySkill(k,1);
    $('skb10-'+k.key).onclick=()=>buySkill(k,10);
    $('skbm-'+k.key).onclick=()=>buySkill(k,skAfford(k));
  }
  $('tab-ench').onclick=()=>{S.tab='ench';save();render();};
  $('tab-skill').onclick=()=>{S.tab='skill';save();render();};
  $('gm-normal').onclick=()=>setMode('normal'); $('gm-ta').onclick=()=>setMode('ta');
  function setMode(m){ if(S.started){ toast('Reset run dulu untuk ganti mode'); return; } S.gmode=m; save(); render(); toast(m==='ta'?'⏳ Time Attack: 30 menit, rebirth aktif':'🏁 Mode Normal'); }
  $('rb-btn').onclick=()=>{
    if(!(isTA() && !S.finished && sumLv()>=TOTAL_LV)) return;
    S.rebirths++; for(const i of ITEMS) S.lv[i.key]=0; S.packs=0; S.streak=0; S.pity={}; S.itemMs={};
    addStones(STONE.rebirth,`rebirth #${S.rebirths}`);
    $('f-roll').textContent=''; $('f-roll').className='roll';
    sfx.max(); confetti(200, innerWidth/2, innerHeight/3);
    toast(`🔁 REBIRTH #${S.rebirths}! Income x${rbMult().toFixed(2)}`,true);
    log(`🔁 Rebirth #${S.rebirths}: enchant reset ke +0, income x${rbMult().toFixed(2)}`,'warn');
    save(); render();
  };
  $('mode-drop').onclick=()=>{S.mode='drop';save();render();};
  $('mode-stay').onclick=()=>{S.mode='stay';save();render();};
  $('sound').onclick=()=>{S.sound=!S.sound;save();render();};

  // ====== finish & leaderboard ======
  function showModal(title,desc,rows){
    $('m-title').textContent=title; $('m-desc').textContent=desc;
    rows.forEach((r,i)=>{ $('m-l'+(i+1)).textContent=r[0]; $('m-v'+(i+1)).textContent=r[1]; });
    try{ $('m-name').value=(hub()&&Hub.user.name)||localStorage.getItem('click-upgrade-name')||''; }catch(e){}
    $('modal').classList.add('show');
  }
  function finish(){
    S.finished=true; addStones(STONE.finish,'tamat run'); save(); cloudSaveSoon(0); confetti(150, innerWidth/2, innerHeight/3); sfx.max();
    showModal('🏆 SEMUA +25!','Weapon dan 5 armor sudah maksimal. Catat ke leaderboard.',
      [['Waktu',mmss(S.playMs)],['Gold dipakai',fmt(S.spent)],['Enchant',S.tries],['Best streak',S.best]]);
  }
  function finishTA(){
    S.finished=true; S.playMs=MODES.ta.ms; save(); cloudSaveSoon(0); confetti(150, innerWidth/2, innerHeight/3); sfx.max();
    log(`⏳ Waktu habis. Skor ${score()} (rebirth ${S.rebirths})`,'warn');
    showModal('⏳ WAKTU HABIS!','30 menit selesai. Catat skor Time Attack ke leaderboard.',
      [['Rebirth',S.rebirths],['Skor',score()],['Gold dipakai',fmt(S.spent)],['Enchant',S.tries]]);
  }
  let lbTab='time', lastId=null;
  const isNormalRow = r => !r.mode || r.mode==='normal';
  const esc = s => s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let boardReq=0;
  async function renderBoard(){
    if(hub()){
      const my=++boardReq;
      try{
        const rows=await Hub.board(GAME_ID,lbTab,10);
        if(my!==boardReq) return;
        if(!rows.length){ $('board').innerHTML=`<div class="empty">Belum ada skor global di papan ini. Jadi yang pertama.</div>`; return; }
        if(lbTab==='ta')
          $('board').innerHTML = `<table><tr><th>#</th><th>Nama</th><th class="r">Rebirth</th><th class="r">Skor</th><th class="r">Enchant</th></tr>`+
            rows.map(r=>`<tr class="${r.me?'me':''}"><td>${r.rank}</td><td>${esc(r.name)}</td><td class="r">${r.meta?.rebirths??'-'}</td><td class="r">${fmt(r.value)}</td><td class="r">${r.meta?.tries??'-'}</td></tr>`).join('')+`</table>`;
        else
          $('board').innerHTML = `<table><tr><th>#</th><th>Nama</th><th class="r">${lbTab==='time'?'Waktu':'Gold'}</th><th class="r">Enchant</th><th class="r">Streak</th></tr>`+
            rows.map(r=>`<tr class="${r.me?'me':''}"><td>${r.rank}</td><td>${esc(r.name)}</td><td class="r">${lbTab==='time'?mmss(r.value):fmt(r.value)}</td><td class="r">${r.meta?.tries??'-'}</td><td class="r">${r.meta?.best??'-'}</td></tr>`).join('')+`</table>`;
        $('lb-scope').textContent='🌐 global';
        return;
      }catch(e){ if(my!==boardReq) return; setCloud('off'); }
    }
    $('lb-scope').textContent='📱 perangkat ini';
    if(lbTab==='ta'){
      const rows=LB.filter(r=>r.mode==='ta').sort((a,b)=> (b.score-a.score) || (b.tries-a.tries)).slice(0,10);
      if(!rows.length){ $('board').innerHTML='<div class="empty">Belum ada skor Time Attack. Coba mode ⏳.</div>'; return; }
      $('board').innerHTML = `<table><tr><th>#</th><th>Nama</th><th class="r">Rebirth</th><th class="r">Skor</th><th class="r">Enchant</th></tr>`+
        rows.map((r,i)=>`<tr class="${r.id===lastId?'me':''}"><td>${i+1}</td><td>${esc(r.name)}</td><td class="r">${r.rebirths}</td><td class="r">${r.score}</td><td class="r">${r.tries}</td></tr>`).join('')+`</table>`;
      return;
    }
    const rows=LB.filter(isNormalRow).sort((a,b)=> lbTab==='time' ? a.ms-b.ms : a.gold-b.gold).slice(0,10);
    if(!rows.length){ $('board').innerHTML='<div class="empty">Belum ada yang tamat. Jadi yang pertama.</div>'; return; }
    $('board').innerHTML = `<table><tr><th>#</th><th>Nama</th><th class="r">Waktu</th><th class="r">Gold</th><th class="r">Enchant</th></tr>`+
      rows.map((r,i)=>`<tr class="${r.id===lastId?'me':''}"><td>${i+1}</td><td>${esc(r.name)}</td><td class="r">${mmss(r.ms)}</td><td class="r">${fmt(r.gold)}</td><td class="r">${r.tries}</td></tr>`).join('')+`</table>`;
  }
  function setLbTab(t){ lbTab=t; for(const x of ['time','gold','ta']) $('tab-'+x).classList.toggle('on',x===t); renderBoard(); }
  $('tab-time').onclick=()=>setLbTab('time'); $('tab-gold').onclick=()=>setLbTab('gold'); $('tab-ta').onclick=()=>setLbTab('ta');
  $('m-save').onclick=()=>{
    const name=($('m-name').value.trim()||'Anon').slice(0,14);
    try{ localStorage.setItem('click-upgrade-name',name); }catch(e){}
    lastId=Date.now();
    LB.push({id:lastId,name,mode:S.gmode,ms:S.playMs,gold:S.spent,tries:S.tries,rebirths:S.rebirths,score:score(),date:new Date().toISOString()});
    LB=LB.slice(-100);
    if(hub()){
      const meta={tries:S.tries,best:S.best,rebirths:S.rebirths};
      if(isTA()) Hub.score(GAME_ID,'ta',score(),meta).catch(()=>{});
      else { Hub.score(GAME_ID,'time',S.playMs,meta).catch(()=>{}); Hub.score(GAME_ID,'gold',S.spent,meta).catch(()=>{}); }
      if(name!==Hub.user.name) Hub.rename(name).then(renderUser).catch(()=>{});
    }
    $('modal').classList.remove('show'); if(isTA()) setLbTab('ta'); newRun(); renderBoard();
  };
  function newRun(){
    const keep=S.sound, tab=S.tab, gm=S.gmode, stones=S.stones; S=fresh(); S.sound=keep; S.tab=tab; S.gmode=gm; S.stones=stones; $('logs').innerHTML='';
    $('f-roll').textContent=''; $('f-roll').className='roll';
    for(const i of ITEMS) $('sl-'+i.key).className='sl';
    save(); cloudSaveSoon(0); render(); log(`Run baru. 💎 ${S.stones} Batu Suci dibawa. Tap untuk mulai timer.`);
  }
  $('reset').onclick=()=>{ if(confirm('Mulai run baru? Progress sekarang hilang (leaderboard tetap).')) { newRun(); toast('Run baru dimulai'); } };

  // ====== tick ======
  setInterval(()=>{
    if(!S.started||S.finished||document.hidden) return;
    S.playMs+=100; const p=perSec(); if(p>0) S.gold+=p/10;
    if(isTA()){ const left=taLeft(); if(left<=0){ finishTA(); } else if(left<=10000 && left%1000<100) sfx.tick(); }
    render();
  },100);
  setInterval(save,3000);

  log(S.started?'Lanjut run.':'Selamat datang. Tap untuk mulai. Buka 📖 untuk cara main.');
  render(); renderUser(); renderBoard();
  try{ if(!localStorage.getItem('click-upgrade-manual')) openManual(); }catch(e){}
  (async()=>{
    if(!window.Hub) return;
    const u=await Hub.me();
    if(u) await afterLogin(); else renderUser();
  })();
  addEventListener('visibilitychange',()=>{ if(document.hidden) cloudSaveNow(true); });
  addEventListener('pagehide',()=>cloudSaveNow(true));
})();
