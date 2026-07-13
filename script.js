// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
const LB_KEY='rescuenet_v4_lb';
function lbGet(){try{return JSON.parse(localStorage.getItem(LB_KEY))||[];}catch{return[];}}
function lbSave(e){localStorage.setItem(LB_KEY,JSON.stringify(e));}
function lbAdd(name,score,day){
  const list=lbGet(),ex=list.find(e=>e.name===name);
  if(ex){if(score>ex.score){ex.score=score;ex.day=day;}}else list.push({name,score,day});
  list.sort((a,b)=>b.score-a.score);lbSave(list.slice(0,20));
}
function lbRender(cid,hl){
  const list=lbGet(),el=document.getElementById(cid);
  if(!list.length){el.innerHTML='<p style="color:#2a4a60;text-align:center;font-size:13px;padding:14px">No scores yet!</p>';return;}
  const m=['🥇','🥈','🥉'];
  el.innerHTML=`<table class="lb-table"><tr><th>#</th><th>Name</th><th>Score</th><th>Day</th></tr>`+
    list.slice(0,12).map((e,i)=>{
      const cls=e.name===hl?'me':i===0?'gold':'';
      return`<tr class="${cls}"><td>${m[i]||i+1}</td><td>${e.name}</td><td>${e.score.toLocaleString()}</td><td>${e.day}</td></tr>`;
    }).join('')+'</table>';
}

// ─── UPGRADE TIERS ────────────────────────────────────────────────────────────
const TIERS=[
  {label:'Net Level 2',cost:300, nets:2,cdMs:3500,spd:1.3,regen:false,mult:1.0,perks:'2nd net · faster deploy · 3.5s cooldown'},
  {label:'Net Level 3',cost:650, nets:3,cdMs:2500,spd:1.6,regen:true, mult:1.0,perks:'3rd net · auto-regen HP · 2.5s cooldown'},
  {label:'Net Level 4',cost:1200,nets:4,cdMs:1800,spd:2.0,regen:true, mult:1.5,perks:'4th net · ×1.5 score · 1.8s cooldown'},
  {label:'Net Level 5',cost:2200,nets:5,cdMs:900, spd:2.5,regen:true, mult:2.0,perks:'5th net · ×2.0 score · 0.9s cooldown · MAX'},
];

// Person image pool
const PERSON_IMGS=['angela.png','resan.png','cutieCrush.png','eprelpel.png','dawangboy.png', 'hitler', 'loverboynicutiecrush.png', 'brentkawaii.png', 'hackir.png', 'mmkdawang.png'];

// ─── GAME ─────────────────────────────────────────────────────────────────────
class RescueGame{
  constructor(){
    this.playerName='Player';this.prevOverlay=null;
    this.nets=[];this.netTier=1;this.cdMs=5000;this.deploySpd=1.0;
    this.scoreMult=1.0;this.regenOn=false;
    this.combo=0;this.comboTimer=null;this.chainCatch=0;this.chainTimer=null;
    this.bossWaveActive=false;this.bossWaveLivesAtStart=5;
    // Power-ups: active flags + timers
    this.shield=0;
    this.speedBoost=false;
    this.goldenMode=false;this.goldenTimer=null;
    this.moneyMult=1;this.leviTimer=null;
    this.heartInterval=null;
    // Weather
    this.weather='clear'; // 'clear' | 'storm' | 'night'
    this.weatherTimer=null;this.rainEls=[];this.lightningTimer=null;
    this.stormSpeedMult=1.0;
    // Net spawn range (Y pixels, computed from net el)
    this.netTopY=0;this.netBotY=0;
    this.gameActive=false;this.isPaused=false;
    this.day=1;this.score=0;this.lives=5;this.money=50;
    this.occupiedLanes=new Set();
    this.audioCtx=null;this.audioReady=false;this.bgmNodes=[];
    this.animId=null;this.dayTimer=null;this.regenInterval=null;
    this.bindUI();
    this.showOverlay('startOverlay');
    lbRender('startLB','');
    this.spawnBubbles();
    this.buildStars();
  }

  showOverlay(id){document.getElementById(id).classList.add('visible');}
  hideOverlay(id){document.getElementById(id).classList.remove('visible');}

  bindUI(){
    document.getElementById('startBtn').onclick   =()=>this.startGame();
    document.getElementById('tryAgainBtn').onclick=()=>{this.hideOverlay('gameOverOverlay');this.startGame();};
    document.getElementById('lbBtn').onclick      =()=>{this.prevOverlay='gameOverOverlay';this.hideOverlay('gameOverOverlay');lbRender('lbContent',this.playerName);this.showOverlay('lbOverlay');};
    document.getElementById('lbBackBtn').onclick  =()=>{this.hideOverlay('lbOverlay');if(this.prevOverlay)this.showOverlay(this.prevOverlay);};
    document.getElementById('repairBtn').onclick  =()=>this.tryRepair();
    document.getElementById('upgradeBtn').onclick =()=>this.openUpgrade();
    document.getElementById('closeUpgrade').onclick=()=>this.closeUpgrade();
    document.getElementById('pauseBtn').onclick   =()=>this.togglePause();
    document.getElementById('nameInput').addEventListener('keydown',e=>{if(e.key==='Enter')this.startGame();});
    window.addEventListener('keydown',e=>{
      if(!this.gameActive)return;
      if(e.key.toLowerCase()==='p')this.togglePause();
      const n=parseInt(e.key);
      if(n>=1&&n<=this.nets.length)this.toggleNet(n-1);
    });
  }

  // ── DECORATIONS ───────────────────────────────────────────────────────────
  spawnBubbles(){
    const gc=document.getElementById('gameContainer');
    setInterval(()=>{
      if(Math.random()>.4)return;
      const b=document.createElement('div');b.className='bubble';
      const sz=4+Math.random()*14;
      b.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;bottom:-20px;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*2}s;opacity:.6`;
      gc.appendChild(b);setTimeout(()=>b.remove(),18000);
    },800);
  }
  buildStars(){
    const c=document.getElementById('stars');
    for(let i=0;i<80;i++){
      const s=document.createElement('div');
      const sz=1+Math.random()*2;
      s.style.cssText=`position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;
        background:white;left:${Math.random()*100}%;top:${Math.random()*60}%;
        opacity:${.4+Math.random()*.6};animation:starTwinkle ${2+Math.random()*3}s ease-in-out infinite;`;
      c.appendChild(s);
    }
    if(!document.getElementById('starStyle')){
      const st=document.createElement('style');st.id='starStyle';
      st.textContent='@keyframes starTwinkle{0%,100%{opacity:.2}50%{opacity:1}}';
      document.head.appendChild(st);
    }
  }

  // ── START ─────────────────────────────────────────────────────────────────
  startGame(){
    const raw=document.getElementById('nameInput').value.trim();
    this.playerName=raw||'Anonymous';
    ['startOverlay','gameOverOverlay','lbOverlay'].forEach(id=>this.hideOverlay(id));
    this.day=1;this.score=0;this.lives=5;this.money=50;
    this.netTier=1;this.cdMs=5000;this.deploySpd=1.0;
    this.scoreMult=1.0;this.regenOn=false;
    this.combo=0;this.chainCatch=0;
    this.shield=0;this.speedBoost=false;this.goldenMode=false;
    this.moneyMult=1;
    if(this.leviTimer){clearTimeout(this.leviTimer);this.leviTimer=null;}
    if(this.heartInterval){clearTimeout(this.heartInterval);this.heartInterval=null;}
    this.weather='clear';this.stormSpeedMult=1.0;
    this.isPaused=false;this.gameActive=false;
    this.occupiedLanes.clear();
    if(this.animId){cancelAnimationFrame(this.animId);this.animId=null;}
    if(this.dayTimer){clearInterval(this.dayTimer);this.dayTimer=null;}
    if(this.regenInterval){clearInterval(this.regenInterval);this.regenInterval=null;}
    if(this.weatherTimer){clearTimeout(this.weatherTimer);this.weatherTimer=null;}
    if(this.lightningTimer){clearInterval(this.lightningTimer);this.lightningTimer=null;}
    if(this.goldenTimer){clearTimeout(this.goldenTimer);this.goldenTimer=null;}
    clearTimeout(this.comboTimer);clearTimeout(this.chainTimer);
    clearTimeout(this.leviTimer);clearTimeout(this.heartInterval);
    this.bossWaveActive=false;
    document.getElementById('bossBarWrap').classList.remove('visible');
    this.stopBGM();
    this.clearWeatherFX();
    document.querySelectorAll('.kid,.debris,.score-pop,.toast,.lane-warning,.powerup').forEach(e=>e.remove());
    this.setWeather('clear');
    // renderControls first so controls-panel has correct height before buildStations measures it
    this.nets=[{health:100,active:false,xPct:50,netH:400,cooldownEnd:0,shielded:false,cooldownRaf:null,netEl:document.createElement('div'),shieldRing:document.createElement('div'),st:document.createElement('div')}];
    this.renderControls();
    this.buildStations(1);
    this.bossWaveActive=false;this.bossWaveLivesAtStart=5;
    this.gameActive=true;
    this.startAudio();
    this.dayCycle();
    this.startRegen();
    this.scheduleWeather();
    this.scheduleHeartDrop();
    this.loop();
    this.renderControls();
    this.updateHUD();
    this.updatePowerupHUD();
  }

  // ── STATIONS ──────────────────────────────────────────────────────────────
  buildStations(count){
    document.getElementById('stations').innerHTML='';
    this.nets=[];
    const positions=count===1?[50]:Array.from({length:count},(_,i)=>25+i*(50/(count-1)));
    // Net must span from bottom of top-pillar (78px) to top of bottom-pillar
    // Station is top:0 bottom:0 (full viewport), bottom pillar is bottom:0 height:108px
    // So net height = full viewport - top offset - bottom pillar height
    const netH=window.innerHeight-78-108;

    positions.forEach((xPct,i)=>{
      const st=document.createElement('div');
      st.style.cssText=`position:absolute;top:0;bottom:0;left:${xPct}%;width:0;pointer-events:none;`;
      const pt=document.createElement('div');pt.className='pillar pillar-top';
      const pb=document.createElement('div');pb.className='pillar pillar-bottom';
      const ne=document.createElement('div');
      ne.style.cssText=`position:absolute;left:50%;transform:translateX(-50%);top:78px;width:38px;height:0;display:none;`;
      ne.className='net-el';
      const shieldRing=document.createElement('div');shieldRing.className='shield-ring';
      shieldRing.style.cssText=`width:60px;height:60px;display:none;`;
      st.appendChild(pt);st.appendChild(pb);st.appendChild(ne);st.appendChild(shieldRing);
      document.getElementById('stations').appendChild(st);
      this.nets.push({st,netEl:ne,shieldRing,active:false,health:100,xPct,netH,cooldownEnd:0,cooldownRaf:null,shielded:false});
    });
    // Compute net Y range for spawn clamping
    const hudH=document.querySelector('.hud').offsetHeight||54;
    const ctrlH=document.querySelector('.controls-panel').offsetHeight||70;
    this.netTopY=78+hudH;
    this.netBotY=window.innerHeight-108-ctrlH;
    this.buildHealthBars();
  }

  buildHealthBars(){
    document.getElementById('healthBars').innerHTML=
      this.nets.map((_,i)=>
        `<div class="net-health-wrap"><div class="net-label">NET ${i+1}</div>
         <div class="bar"><div class="hbar" id="hbar${i}"></div></div></div>`
      ).join('');
  }

  // ── CONTROLS ──────────────────────────────────────────────────────────────
  renderControls(){
    document.getElementById('netControlsRow').innerHTML=
      this.nets.map((_,i)=>
        `<div class="net-controls">
          <div class="net-station-label">NET ${i+1} [${i+1}]</div>
          <div class="btn-wrap">
            <button class="ctrl-btn btn-deploy"  id="dep${i}" onclick="game.toggleNet(${i})">🚀 Deploy</button>
            <button class="ctrl-btn btn-retract" id="ret${i}" style="display:none" onclick="game.toggleNet(${i})">↩️ Retract</button>
            <div class="cooldown-overlay" id="cd${i}"><span class="cooldown-text" id="cdt${i}"></span></div>
          </div>
        </div>`
      ).join('');
    this.refreshControlStates();
  }

  refreshControlStates(){
    const now=Date.now();
    this.nets.forEach((n,i)=>{
      const dep=document.getElementById('dep'+i);
      const ret=document.getElementById('ret'+i);
      const cdo=document.getElementById('cd'+i);
      const cdt=document.getElementById('cdt'+i);
      if(!dep)return;
      const onCd=now<n.cooldownEnd;
      const cdFrac=onCd?(n.cooldownEnd-now)/this.cdMs:0;
      const cdSec=onCd?((n.cooldownEnd-now)/1000).toFixed(1):'';
      if(n.active){dep.style.display='none';ret.style.display='';ret.disabled=false;if(cdo)cdo.style.height='0%';}
      else{dep.style.display='';ret.style.display='none';dep.disabled=onCd||n.health<=0;if(cdo)cdo.style.height=(cdFrac*100)+'%';if(cdt)cdt.textContent=onCd?cdSec+'s':'';}
    });
    const anyDamaged=this.nets.some(n=>n.health<100);
    document.getElementById('repairBtn').disabled=!anyDamaged||this.money<25;
  }

  runCooldownAnim(i){
    const n=this.nets[i];
    const animate=()=>{
      if(Date.now()>=n.cooldownEnd||n.active||!this.gameActive){this.refreshControlStates();return;}
      this.refreshControlStates();
      n.cooldownRaf=requestAnimationFrame(animate);
    };
    n.cooldownRaf=requestAnimationFrame(animate);
  }

  toggleNet(i){
    if(!this.gameActive||this.isPaused)return;
    const n=this.nets[i];
    if(n.active){this.retractNet(i);}
    else{
      if(Date.now()<n.cooldownEnd){this.toast(`Net ${i+1} recharging…`);return;}
      if(n.health<=0){this.toast(`Net ${i+1} broken — repair ($25) first!`);return;}
      this.launchNet(i);
    }
  }

  launchNet(i){
    const n=this.nets[i];n.active=true;n.netEl.style.display='block';
    this.refreshNetAppearance(i);
    let h=0;
    const spd=this.speedBoost?this.deploySpd*2.5:this.deploySpd;
    const grow=setInterval(()=>{
      if(this.isPaused||!n.active){clearInterval(grow);return;}
      h=Math.min(h+13*spd,n.netH);n.netEl.style.height=h+'px';
      if(h>=n.netH)clearInterval(grow);
    },10);
    this.refreshControlStates();
    if(this.speedBoost){this.speedBoost=false;this.updatePowerupHUD();}
  }

  retractNet(i){
    const n=this.nets[i];n.active=false;
    n.netEl.style.height='0';n.netEl.style.display='none';
    n.cooldownEnd=Date.now()+this.cdMs;
    this.runCooldownAnim(i);this.refreshControlStates();
  }

  refreshNetAppearance(i){
    const n=this.nets[i];
    n.netEl.classList.toggle('damaged',n.health<50&&n.health>0);
    n.netEl.classList.toggle('broken',n.health<=0);
    n.shieldRing.style.display=n.shielded&&n.active?'block':'none';
  }

  // ── REPAIR ────────────────────────────────────────────────────────────────
  tryRepair(){
    if(!this.gameActive||this.isPaused)return;
    const damaged=this.nets.filter(n=>n.health<100);
    if(!damaged.length){this.toast('All nets at full health.');return;}
    if(this.money<25){this.toast('Not enough money! ($25 needed)');return;}
    this.money-=25;
    // Only repair retracted nets (deployed broken nets stay broken until retracted)
    const repairable=damaged.filter(n=>!n.active);
    if(!repairable.length){this.toast('Retract the broken net first to repair it!');return;}
    // Refund if nothing actually repaired
    repairable.forEach(n=>{n.health=100;});
    this.showPop(window.innerWidth/2,window.innerHeight/2-40,'🔧 Repaired!','gold');
    this.nets.forEach((_,i)=>this.refreshNetAppearance(i));
    this.updateHUD();
  }

  // ── AUTO REGEN ────────────────────────────────────────────────────────────
  startRegen(){
    if(this.regenInterval)clearInterval(this.regenInterval);
    this.regenInterval=setInterval(()=>{
      if(!this.gameActive||this.isPaused||!this.regenOn)return;
      this.nets.forEach((n,i)=>{
        if(!n.active&&n.health>0&&n.health<100){
          n.health=Math.min(100,n.health+4);
          this.refreshNetAppearance(i);
          n.netEl.classList.add('regen-glow');
          setTimeout(()=>n.netEl.classList.remove('regen-glow'),400);
        }
      });
      this.updateHUD();
    },3000);
  }

  // ── SPAWN ─────────────────────────────────────────────────────────────────
  spawn(){
    if(this.isPaused||!this.gameActive||this.bossWaveActive)return;
    const stormExtra=this.weather==='storm'?0.006:0;
    if(Math.random()>0.014+this.day*0.0025+stormExtra)return;
    const lane=Math.floor(Math.random()*8)+2;
    if(this.occupiedLanes.has(lane))return;
    // Power-up rare spawn
    if(Math.random()<0.018){this.spawnPowerup(lane);return;}
    const kidChance=Math.max(0.38,0.70-this.day*0.02);
    const type=Math.random()<kidChance?'kid':'debris';
    this.showLaneWarn(lane,type);
    setTimeout(()=>{if(this.gameActive)this.createObject(type,lane);},380);
    this.occupiedLanes.add(lane);
    setTimeout(()=>this.occupiedLanes.delete(lane),2800);
  }

  // Compute Y from lane, clamped to net's catchable range
  laneToY(lane){
    const hudH=document.querySelector('.hud').offsetHeight||54;
    const ctrlH=document.querySelector('.controls-panel').offsetHeight||70;
    const usableTop=78+hudH;
    const usableBot=window.innerHeight-108-ctrlH-42; // 42 = kid height
    const totalH=usableBot-usableTop;
    // 8 lanes spread across usable height
    const laneH=totalH/8;
    const y=usableTop+(lane-2)*laneH+laneH/2;
    return Math.max(usableTop,Math.min(usableBot,y));
  }

  showLaneWarn(lane,type){
    const y=this.laneToY(lane);
    const el=document.createElement('div');
    el.className='lane-warning '+(type==='kid'?'kid-warn':type==='powerup'?'pow-warn':'deb-warn');
    el.style.top=y+'px';
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(()=>el.remove(),460);
  }

  createObject(type,lane){
    const el=document.createElement('div');
    el.className=type;
    const y=this.laneToY(lane);
    el.style.top=y+'px';
    el.style.left='-70px';
    const stormMult=this.weather==='storm'?1.3:1;
    const base=type==='kid'?1.1:1.65;
    el.dataset.speed=((base+(this.day-1)*0.27)*stormMult).toFixed(2);
    if(type==='kid'){
      // Random person image
      const img=PERSON_IMGS[Math.floor(Math.random()*PERSON_IMGS.length)];
      el.style.backgroundImage=`url('${img}')`;
      if(this.weather==='night')el.classList.add('glow');
    }
    document.getElementById('gameContainer').appendChild(el);
  }

  spawnPowerup(lane, forcedType){
    this.showLaneWarn(lane,'powerup');
    setTimeout(()=>{
      if(!this.gameActive)return;
      // weighted pool: normal types common, weather/dayreset only during relevant conditions, levi very rare
      let pool=['shield','speedup','golden','shield','speedup'];
      if(this.weather!=='clear') pool.push('clearsky','clearsky');
      pool.push('dayreset');
      // levi easter egg: ~8% of powerup spawns
      if(Math.random()<0.08) pool=['levi'];
      const t=forcedType||pool[Math.floor(Math.random()*pool.length)];
      const el=document.createElement('div');
      el.className='powerup '+t;
      el.dataset.ptype=t;
      const y=this.laneToY(lane);
      el.style.top=y+'px';el.style.left='-70px';
      el.dataset.speed=(0.85+(this.day-1)*0.12).toFixed(2);
      const icons={shield:'🛡️',speedup:'⚡',golden:'⭐',heart:'❤️',clearsky:'🌤️',dayreset:'🗓️',levi:'Levi cutie'};
      el.textContent=icons[t]||'?';
      if(t==='levi') el.style.animation='leviFloat 1.2s ease-in-out infinite';
      document.getElementById('gameContainer').appendChild(el);
      this.occupiedLanes.add(lane);setTimeout(()=>this.occupiedLanes.delete(lane),2800);
    },380);
  }

  scheduleHeartDrop(){
    // Heart drops: start every 45s, minimum 18s, shortens slightly each day
    const interval=Math.max(18000, 45000 - this.day*800);
    this.heartInterval=setTimeout(()=>{
      if(!this.gameActive)return;
      const lane=Math.floor(Math.random()*8)+2;
      if(!this.occupiedLanes.has(lane)){
        this.showLaneWarn(lane,'powerup');
        setTimeout(()=>{
          if(!this.gameActive)return;
          const el=document.createElement('div');
          el.className='powerup heart';el.dataset.ptype='heart';
          const y=this.laneToY(lane);
          el.style.top=y+'px';el.style.left='-70px';
          el.dataset.speed=(0.8+(this.day-1)*0.1).toFixed(2);
          el.textContent='❤️';
          document.getElementById('gameContainer').appendChild(el);
          this.occupiedLanes.add(lane);setTimeout(()=>this.occupiedLanes.delete(lane),2800);
        },380);
      }
      this.scheduleHeartDrop(); // reschedule
    },interval);
  }

  // ── MOVE & COLLIDE ────────────────────────────────────────────────────────
  moveObjects(){
    if(this.isPaused||!this.gameActive)return;
    const nRects=this.nets.map(n=>n.active?n.netEl.getBoundingClientRect():null);

    document.querySelectorAll('.kid,.debris,.powerup').forEach(obj=>{
      let left=parseFloat(obj.style.left)+parseFloat(obj.dataset.speed);
      obj.style.left=left+'px';
      const oRect=obj.getBoundingClientRect();
      let caught=false;
      const isKid=obj.classList.contains('kid');
      const isDebris=obj.classList.contains('debris');
      const isPup=obj.classList.contains('powerup');

      nRects.forEach((nr,i)=>{
        if(!nr||caught)return;
        const hit=oRect.right>=nr.left&&oRect.left<=nr.right&&oRect.bottom>=nr.top&&oRect.top<=nr.bottom;
        if(!hit)return;

        if(isPup){
          this.collectPowerup(obj.dataset.ptype,i);
          obj.remove();caught=true;return;
        }
        if(isKid){
          if(this.nets[i].health<=0)return; // broken net can't catch kids
          const goldMult=this.goldenMode?5:1;
          const pts=Math.round((100+(this.day-1)*30)*this.scoreMult*this.comboMult()*goldMult);
          this.score+=pts;this.money+=Math.round(12*this.moneyMult);
          this.addCombo();this.addChain(pts,oRect);
          this.showPop(oRect.left+oRect.width/2,oRect.top,'+'+(this.goldenMode?'⭐'+pts:pts),'pos');
          this.playSFX('catch');
          obj.remove();caught=true;return;
        }
        if(isDebris){
          if(this.nets[i].shielded){
            // Shield absorbs one debris hit
            this.nets[i].shielded=false;this.shield=Math.max(0,this.shield-1);
            this.refreshNetAppearance(i);this.updatePowerupHUD();
            this.showPop(oRect.left+oRect.width/2,oRect.top,'🛡️ Blocked!','pow');
            obj.remove();caught=true;return;
          }
          if(this.nets[i].health<=0)return; // broken net, debris passes through freely
          const now=Date.now(),lh=parseFloat(obj.dataset['lh'+i]||'0');
          if(now-lh>480){
            obj.dataset['lh'+i]=now;
            const dmg=8+Math.floor(this.day*1.1);
            this.nets[i].health=Math.max(0,this.nets[i].health-dmg);
            this.showPop(oRect.left+oRect.width/2,oRect.top,`-${dmg}`,'neg');
            this.playSFX('hit');
            this.refreshNetAppearance(i);
            if(this.nets[i].health<=0)this.toast(`Net ${i+1} BROKEN — retract & repair!`);
          }
        }
      });

      if(!caught&&left>window.innerWidth+20){
        if(isKid){
          this.lives--;this.resetCombo();this.flashDamage();
          this.playSFX('lose');
          this.showPop(window.innerWidth-90,window.innerHeight/2-20,'-1 ❤️','neg');
        }
        obj.remove();
      }
    });
  }

  // ── POWER-UPS ─────────────────────────────────────────────────────────────
  collectPowerup(type,netIdx){
    this.playSFX('powerup');
    if(type==='shield'){
      this.shield++;
      if(netIdx!==undefined&&netIdx<this.nets.length){
        this.nets[netIdx].shielded=true;
        this.refreshNetAppearance(netIdx);
      }
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,'🛡️ SHIELD!','pow');
    }else if(type==='speedup'){
      this.speedBoost=true;
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,'⚡ SPEED BOOST!','pow');
    }else if(type==='golden'){
      this.goldenMode=true;
      clearTimeout(this.goldenTimer);
      this.goldenTimer=setTimeout(()=>{this.goldenMode=false;this.updatePowerupHUD();},8000);
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,'⭐ GOLDEN MODE! (8s)','gold');
    }else if(type==='heart'){
      this.lives=Math.min(this.lives+1,99);
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,'+1 ❤️ EXTRA LIFE!','pos');
      this.playSFX('heart');
    }else if(type==='clearsky'){
      this.setWeather('clear');
      clearTimeout(this.weatherTimer);this.scheduleWeather();
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,'🌤️ WEATHER CLEARED!','gold');
    }else if(type==='dayreset'){
      // Reset day timer by restarting the interval, give bonus money
      clearInterval(this.dayTimer);this.dayCycle();
      this.money+=40+this.day*5;
      this.showPop(window.innerWidth/2,window.innerHeight/2-40,`🗓️ DAY EXTENDED! +$${40+this.day*5}`,'gold');
    }else if(type==='levi'){
      this.moneyMult=2;
      clearTimeout(this.leviTimer);
      this.leviTimer=setTimeout(()=>{this.moneyMult=1;this.updatePowerupHUD();},5000);
      // Easter egg cinematic
      const ov=document.getElementById('cinematicOverlay');
      document.getElementById('cinChain').textContent='💜 Levi cutie 💜';
      document.getElementById('cinPts').textContent='×2 MONEY for 5s!';
      document.getElementById('cinSub').textContent='Easter egg unlocked! 🐱';
      ov.classList.remove('show','hide');void ov.offsetWidth;ov.classList.add('show');
      clearTimeout(this._cinTimer);
      this._cinTimer=setTimeout(()=>{ov.classList.add('hide');setTimeout(()=>ov.classList.remove('show','hide'),500);},2000);
      this.playSFX('levi');
    }
    this.updatePowerupHUD();
  }

  updatePowerupHUD(){
    document.getElementById('pup-shield').classList.toggle('active',this.shield>0);
    document.getElementById('pup-speed').classList.toggle('active',this.speedBoost);
    document.getElementById('pup-golden').classList.toggle('active',this.goldenMode);
    const leviEl=document.getElementById('pup-levi');
    if(leviEl)leviEl.classList.toggle('active',this.moneyMult>1);
  }

  // ── COMBO & CHAIN ─────────────────────────────────────────────────────────
  comboMult(){return 1+Math.floor(this.combo/3)*0.1;}
  addCombo(){
    this.combo++;clearTimeout(this.comboTimer);
    const badge=document.getElementById('comboBadge');
    if(this.combo>=3){
      badge.textContent=`COMBO ×${this.combo} (+${Math.round((this.comboMult()-1)*100)}%)`;
      badge.style.display='';badge.style.animation='none';void badge.offsetWidth;badge.style.animation='';
    }
    this.comboTimer=setTimeout(()=>this.resetCombo(),3000);
  }
  resetCombo(){this.combo=0;document.getElementById('comboBadge').style.display='none';}

  addChain(pts,oRect){
    this.chainCatch++;clearTimeout(this.chainTimer);
    if(this.chainCatch>=3){
      // Cinematic!
      this.showCinematic(this.chainCatch,pts);
    }
    this.chainTimer=setTimeout(()=>{this.chainCatch=0;},4000);
  }

  showCinematic(chain,lastPts){
    const ov=document.getElementById('cinematicOverlay');
    const labels=['','','','TRIPLE SAVE!','QUAD SAVE!','PENTA SAVE!','MEGA SAVE!','ULTRA SAVE!!','LEGENDARY!!!'];
    document.getElementById('cinChain').textContent=labels[Math.min(chain,labels.length-1)]||`${chain}× RESCUE CHAIN!`;
    document.getElementById('cinPts').textContent=`+${lastPts} pts`;
    document.getElementById('cinSub').textContent='Keep it going!';
    ov.classList.remove('show','hide');void ov.offsetWidth;
    ov.classList.add('show');
    clearTimeout(this._cinTimer);
    this._cinTimer=setTimeout(()=>{ov.classList.add('hide');setTimeout(()=>ov.classList.remove('show','hide'),500);},1600);
  }

  // ── WEATHER ───────────────────────────────────────────────────────────────
  scheduleWeather(){
    // Cycle: 25-40s clear → 15-25s storm/night → back
    const nextIn=(25+Math.random()*15)*1000;
    this.weatherTimer=setTimeout(()=>{
      if(!this.gameActive)return;
      const pick=this.weather==='clear'?(Math.random()<0.5?'storm':'night'):'clear';
      this.setWeather(pick);
      if(pick!=='clear'){
        const dur=(15+Math.random()*10)*1000;
        setTimeout(()=>{if(this.gameActive)this.setWeather('clear');},dur);
      }
      this.scheduleWeather();
    },nextIn);
  }

  setWeather(w){
    this.weather=w;
    const sky=document.getElementById('sky');
    const so=document.getElementById('stormOverlay');
    const no=document.getElementById('nightOverlay');
    const stars=document.getElementById('stars');
    const wb=document.getElementById('weatherBadge');
    sky.className='sky'+(w==='storm'?' storm':w==='night'?' night':'');
    so.classList.toggle('active',w==='storm');
    no.classList.toggle('active',w==='night');
    stars.classList.toggle('visible',w==='night');
    // Update spotlight x based on nets
    if(w==='night'&&this.nets.length){
      const xPct=this.nets.map(n=>n.xPct).reduce((a,b)=>a+b)/this.nets.length;
      document.getElementById('nightOverlay').style.setProperty('--spot-x',xPct+'%');
    }
    if(w==='storm'){wb.textContent='⛈️ STORM';wb.className='weather-badge storm';wb.style.display='block';}
    else if(w==='night'){wb.textContent='🌙 NIGHT';wb.className='weather-badge night';wb.style.display='block';}
    else wb.style.display='none';
    this.stormSpeedMult=w==='storm'?1.3:1.0;
    this.clearWeatherFX();
    if(w==='storm'){this.startRain();this.startLightning();}
    if(w==='clear'){this.playSFX('weatherClear');}
    // Night: make kids glow
    document.querySelectorAll('.kid').forEach(k=>k.classList.toggle('glow',w==='night'));
  }

  clearWeatherFX(){
    this.rainEls.forEach(e=>e.remove());this.rainEls=[];
    clearInterval(this.lightningTimer);this.lightningTimer=null;
  }
  startRain(){
    for(let i=0;i<60;i++){
      const r=document.createElement('div');r.className='raindrop';
      const h=30+Math.random()*80;
      r.style.cssText=`left:${Math.random()*100}%;height:${h}px;animation-duration:${.4+Math.random()*.4}s;animation-delay:${Math.random()*.4}s;top:-${h}px;`;
      document.getElementById('gameContainer').appendChild(r);
      this.rainEls.push(r);
    }
  }
  startLightning(){
    this.lightningTimer=setInterval(()=>{
      if(!this.gameActive||this.weather!=='storm')return;
      if(Math.random()>.3)return;
      const el=document.getElementById('lightning');
      el.classList.add('flash');
      setTimeout(()=>el.classList.remove('flash'),80);
      this.playSFX('thunder');
    },2500);
  }

  // ── DAY CYCLE ─────────────────────────────────────────────────────────────
  dayCycle(){
    this.dayTimer=setInterval(()=>{
      if(!this.gameActive||this.isPaused)return;
      this.day++;this.money+=30+this.day*8;
      this.showDayFlash();this.renderControls();this.updateHUD();
      if(this.day%5===0)this.triggerBossWave();
    },20000);
  }

  // ── BOSS WAVE ─────────────────────────────────────────────────────────────
  triggerBossWave(){
    if(this.bossWaveActive)return;
    this.bossWaveActive=true;
    this.bossWaveLivesAtStart=this.lives;
    const waveNum=Math.floor(this.day/5);
    const ov=document.getElementById('bossOverlay');
    document.getElementById('bossTitleText').textContent=`WAVE ${waveNum} INCOMING`;
    document.getElementById('bossSubText').textContent=
      waveNum>=3?'They\'re coming in fast — ALL NETS NOW!':
      waveNum>=2?'Double surge — deploy everything!':
      'Massive surge — brace your nets!';
    // Show warning
    ov.classList.remove('show');void ov.offsetWidth;ov.classList.add('show');
    this.playSFX('bossWarn');
    // Show progress bar
    const bw=document.getElementById('bossBarWrap');
    const bf=document.getElementById('bossBarFill');
    bw.classList.add('visible');bf.style.width='0%';

    // After 2.5s warning, spawn the wave
    setTimeout(()=>{
      if(!this.gameActive)return;
      this.spawnBossWave(waveNum,bf);
    },2500);
  }

  spawnBossWave(waveNum,barFill){
    const kidCount=4+waveNum*2;    // 6 kids wave 1, 8 wave 2, etc.
    const debrisCount=2+waveNum;   // 3 debris wave 1, 4 wave 2, etc.
    const objects=[
      ...Array.from({length:kidCount},()=>'kid'),
      ...Array.from({length:debrisCount},()=>'debris'),
    ].sort(()=>Math.random()-.5);  // shuffle

    const allLanes=[2,3,4,5,6,7,8,9];
    let spawnIdx=0;
    const total=objects.length;
    const interval=setInterval(()=>{
      if(!this.gameActive){clearInterval(interval);this.endBossWave(barFill);return;}
      if(spawnIdx>=total){clearInterval(interval);
        // Wait for all objects to clear then resolve
        setTimeout(()=>this.endBossWave(barFill),4000);return;}
      const type=objects[spawnIdx];
      const lane=allLanes[spawnIdx%allLanes.length];
      this.showLaneWarn(lane,type);
      const si=spawnIdx;
      setTimeout(()=>{
        if(!this.gameActive)return;
        this.createObject(type,lane);
      },380);
      spawnIdx++;
      barFill.style.width=((spawnIdx/total)*100)+'%';
    },500);
  }

  endBossWave(barFill){
    if(!this.bossWaveActive)return;
    this.bossWaveActive=false;
    const survived=this.lives>=this.bossWaveLivesAtStart;
    const bonus=survived?150+this.day*10:30;
    this.money+=bonus;
    document.getElementById('bossBarWrap').classList.remove('visible');
    if(barFill)barFill.style.width='0%';
    // Cinematic result
    const ov=document.getElementById('cinematicOverlay');
    document.getElementById('cinChain').textContent=survived?'⚡ WAVE SURVIVED!':'💀 WAVE ENDURED';
    document.getElementById('cinPts').textContent=`+$${bonus} bonus`;
    document.getElementById('cinSub').textContent=survived?'Perfect defense! Bonus awarded!':'No lives lost bonus missed.';
    ov.classList.remove('show','hide');void ov.offsetWidth;ov.classList.add('show');
    clearTimeout(this._cinTimer);
    this._cinTimer=setTimeout(()=>{ov.classList.add('hide');setTimeout(()=>ov.classList.remove('show','hide'),500);},2200);
    this.playSFX(survived?'bossWin':'lose');
    this.updateHUD();
  }
  showDayFlash(){
    const el=document.getElementById('dayFlash');
    el.textContent='DAY '+this.day;
    el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  updateHUD(){
    document.getElementById('dayNum').textContent=this.day;
    document.getElementById('scoreNum').textContent=this.score.toLocaleString();
    document.getElementById('livesNum').textContent=this.lives;
    document.getElementById('moneyNum').textContent='$'+this.money;
    document.getElementById('tierBadge').textContent='NET LV.'+this.netTier;
    const mb=document.getElementById('multBadge');
    const displayMult=this.goldenMode?this.scoreMult*5:this.scoreMult;
    if(displayMult>1){mb.style.display='';mb.textContent='×'+displayMult.toFixed(1)+' pts';}
    else mb.style.display='none';
    this.nets.forEach((n,i)=>{
      const bar=document.getElementById('hbar'+i);if(!bar)return;
      bar.style.width=n.health+'%';
      bar.style.background=n.health>60?'linear-gradient(90deg,#2ecc71,#27ae60)':n.health>30?'linear-gradient(90deg,#f39c12,#e67e22)':'linear-gradient(90deg,#e74c3c,#c0392b)';
    });
    this.refreshControlStates();
    if(this.lives<=0)this.triggerGameOver();
  }

  // ── UPGRADE ───────────────────────────────────────────────────────────────
  openUpgrade(){if(!this.gameActive)return;this.renderUpgradeModal();document.getElementById('upgradeModal').style.display='block';this.isPaused=true;}
  closeUpgrade(){document.getElementById('upgradeModal').style.display='none';this.isPaused=false;}
  renderUpgradeModal(){
    document.getElementById('upgradeRows').innerHTML=TIERS.map((t,i)=>{
      const tier=i+2,owned=this.netTier>=tier,next=this.netTier===tier-1,afford=this.money>=t.cost;
      return`<div class="up-row">
        <div><div class="up-name">${t.label}</div><div class="up-perks">${t.perks}</div>
        ${owned?`<div class="up-owned">✅ Owned</div>`:`<div class="up-cost">💰 $${t.cost.toLocaleString()}</div>`}</div>
        <button class="up-btn" ${owned||!next||!afford?'disabled':''} onclick="game.buyUpgrade(${i})">
          ${owned?'✓':!next?'🔒':!afford?`Need $${t.cost-this.money}`:'BUY'}</button>
      </div>`;
    }).join('');
  }
  buyUpgrade(i){
    const t=TIERS[i];if(this.money<t.cost)return;
    this.money-=t.cost;this.netTier=i+2;this.cdMs=t.cdMs;
    this.deploySpd=t.spd;this.regenOn=t.regen;this.scoreMult=t.mult;
    this.buildStations(t.nets);
    this.nets.forEach(n=>{n.health=100;});
    this.renderControls();this.updateHUD();this.renderUpgradeModal();
    this.showPop(window.innerWidth/2,window.innerHeight/2,'⬆️ Upgraded!','gold');
  }

  // ── GAME OVER ─────────────────────────────────────────────────────────────
  triggerGameOver(){
    if(!this.gameActive)return;this.gameActive=false;
    clearInterval(this.dayTimer);clearInterval(this.regenInterval);
    clearTimeout(this.weatherTimer);clearInterval(this.lightningTimer);
    clearTimeout(this.comboTimer);clearTimeout(this.chainTimer);clearTimeout(this.goldenTimer);
    cancelAnimationFrame(this.animId);
    this.stopBGM();this.clearWeatherFX();
    document.querySelectorAll('.kid,.debris,.powerup').forEach(e=>e.remove());
    this.nets.forEach((_,i)=>this.retractNet(i));
    lbAdd(this.playerName,this.score,this.day);
    document.getElementById('goText').textContent=`${this.playerName}  ·  Score: ${this.score.toLocaleString()}  ·  Day: ${this.day}`;
    this.showOverlay('gameOverOverlay');
  }

  // ── PAUSE ─────────────────────────────────────────────────────────────────
  togglePause(){
    if(!this.gameActive)return;this.isPaused=!this.isPaused;
    document.getElementById('pauseOverlay').classList.toggle('visible',this.isPaused);
  }

  // ── LOOP ──────────────────────────────────────────────────────────────────
  loop(){
    const tick=()=>{
      if(!this.gameActive)return;
      if(!this.isPaused){this.spawn();this.moveObjects();this.updateHUD();}
      this.animId=requestAnimationFrame(tick);
    };
    this.animId=requestAnimationFrame(tick);
  }

  // ── FX ────────────────────────────────────────────────────────────────────
  flashDamage(){
    const f=document.getElementById('damageFlash'),c=document.getElementById('gameContainer');
    f.classList.add('active');c.classList.add('shaking');
    setTimeout(()=>{f.classList.remove('active');c.classList.remove('shaking');},380);
  }
  toast(msg){
    document.querySelectorAll('.toast').forEach(e=>e.remove());
    const el=document.createElement('div');el.className='toast';el.textContent=msg;
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(()=>el.remove(),2000);
  }
  showPop(x,y,text,cls){
    const el=document.createElement('div');el.className='score-pop '+cls;
    el.style.left=x+'px';el.style.top=y+'px';el.textContent=text;
    document.getElementById('gameContainer').appendChild(el);
    setTimeout(()=>el.remove(),950);
  }

  // ── AUDIO: Energetic Frutiger Aero Hawaiian Ocean ─────────────────────────
  startAudio(){
    if(this.audioReady)return;
    try{this.audioCtx=new(window.AudioContext||window.webkitAudioContext)();this.audioReady=true;this.playBGM();}catch(e){}
  }
  stopBGM(){
    this.bgmNodes.forEach(n=>{try{n.stop();}catch(e){}});this.bgmNodes=[];
    clearInterval(this.melodyInt);clearInterval(this.ukeInt);clearInterval(this.padInt);
    this.melodyInt=null;this.ukeInt=null;this.padInt=null;
  }

  // Tone helper
  tone(freq,time,dur,type='sine',vol=0.08,detune=0){
    const ctx=this.audioCtx;
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=freq;o.detune.value=detune;
    g.gain.setValueAtTime(0,time);
    g.gain.linearRampToValueAtTime(vol,time+dur*.15);
    g.gain.exponentialRampToValueAtTime(0.0001,time+dur);
    o.connect(g);g.connect(ctx.destination);
    o.start(time);o.stop(time+dur+.05);
    this.bgmNodes.push(o);
  }

  // Pluck: simulated ukulele (sine + quick decay)
  pluck(freq,time,vol=0.14){
    const ctx=this.audioCtx;
    const o=ctx.createOscillator(),g=ctx.createGain();
    const o2=ctx.createOscillator(),g2=ctx.createGain();
    o.type='triangle';o.frequency.value=freq;
    o2.type='sine';o2.frequency.value=freq*2.01;
    g.gain.setValueAtTime(vol,time);g.gain.exponentialRampToValueAtTime(0.0001,time+0.9);
    g2.gain.setValueAtTime(vol*.3,time);g2.gain.exponentialRampToValueAtTime(0.0001,time+0.4);
    o.connect(g);g.connect(ctx.destination);
    o2.connect(g2);g2.connect(ctx.destination);
    o.start(time);o.stop(time+1);o2.start(time);o2.stop(time+.5);
    this.bgmNodes.push(o,o2);
  }

  // Marimba hit (bright triangle + fast decay)
  marimba(freq,time,vol=0.1){
    const ctx=this.audioCtx;
    const o=ctx.createOscillator(),g=ctx.createGain();
    o.type='sine';o.frequency.setValueAtTime(freq*1.5,time);
    o.frequency.exponentialRampToValueAtTime(freq,time+0.04);
    g.gain.setValueAtTime(vol,time);g.gain.exponentialRampToValueAtTime(0.0001,time+0.35);
    o.connect(g);g.connect(ctx.destination);
    o.start(time);o.stop(time+.4);this.bgmNodes.push(o);
  }

  playBGM(){
    const ctx=this.audioCtx;
    // C major pentatonic: C4 E4 G4 A4 C5 E5 G5
    const pent=[261.63,329.63,392.00,440.00,523.25,659.25,783.99];
    // Hawaiian uke chords: C maj arpeggios
    const chords=[
      [261.63,329.63,392.00,523.25],  // C
      [293.66,369.99,440.00,587.33],  // D
      [329.63,415.30,493.88,659.25],  // E minor feel
      [246.94,311.13,392.00,493.88],  // Bm feel
    ];

    // 1. Ukulele strum pattern (every 1.5s)
    let chordIdx=0;
    this.ukeInt=setInterval(()=>{
      if(this.isPaused||!this.gameActive)return;
      const t=ctx.currentTime;
      const ch=chords[chordIdx%chords.length];
      // Strum: rapid sequence of plucks
      ch.forEach((f,i)=>this.pluck(f,t+i*0.04,0.10));
      // Off-beat pluck (Hawaiian feel)
      setTimeout(()=>{
        if(!this.gameActive)return;
        const t2=ctx.currentTime;
        this.pluck(ch[1],t2,0.07);
        this.pluck(ch[3],t2+0.05,0.06);
      },750);
      chordIdx++;
    },1500);

    // 2. Marimba melody (every beat ~600ms)
    const melody=[0,2,4,2,4,5,4,2,0,2,4,6,5,4,2,4]; // indexes into pent
    let mIdx=0;
    this.melodyInt=setInterval(()=>{
      if(this.isPaused||!this.gameActive)return;
      const t=ctx.currentTime;
      this.marimba(pent[melody[mIdx%melody.length]],t,0.09);
      // Occasional harmony
      if(mIdx%4===0)this.marimba(pent[Math.min(melody[mIdx%melody.length]+2,pent.length-1)],t+0.01,0.05);
      mIdx++;
    },600);

    // 3. Ocean atmosphere (filtered noise)
    const buf=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);
    const data=buf.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
    const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=280;lp.Q.value=0.7;
    const trem=ctx.createOscillator();trem.frequency.value=0.22;trem.type='sine';
    const tg=ctx.createGain();tg.gain.value=0.032;
    const ag=ctx.createGain();ag.gain.value=0.055;
    trem.connect(tg);tg.connect(ag.gain);
    src.connect(lp);lp.connect(ag);ag.connect(ctx.destination);
    trem.start();src.start();this.bgmNodes.push(src,trem);

    // 4. Bubble pops (random)
    this.padInt=setInterval(()=>{
      if(this.isPaused||!this.gameActive)return;
      if(Math.random()>.5)return;
      const t=ctx.currentTime;
      // Quick chirp: simulated bubble
      const f=600+Math.random()*800;
      this.tone(f,t,0.12,'sine',0.04,-20+Math.random()*40);
    },800);
  }

  playSFX(type){
    if(!this.audioCtx)return;
    const ctx=this.audioCtx,t=ctx.currentTime;
    if(type==='catch'){
      // Happy marimba ding
      this.marimba(880,t,0.13);this.marimba(1108,t+0.07,0.09);
    }else if(type==='hit'){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sawtooth';o.frequency.setValueAtTime(220,t);o.frequency.linearRampToValueAtTime(70,t+.22);
      g.gain.setValueAtTime(.14,t);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.3);
    }else if(type==='lose'){
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='square';o.frequency.setValueAtTime(300,t);o.frequency.linearRampToValueAtTime(80,t+.5);
      g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.0001,t+.6);
      o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.7);
    }else if(type==='powerup'){
      [523.25,659.25,783.99,1046.5].forEach((f,i)=>this.marimba(f,t+i*0.08,0.12));
    }else if(type==='thunder'){
      const buf=ctx.createBuffer(1,ctx.sampleRate*.4,ctx.sampleRate);
      const d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1);
      const src=ctx.createBufferSource();src.buffer=buf;
      const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=180;
      const g=ctx.createGain();g.gain.setValueAtTime(.25,t);g.gain.exponentialRampToValueAtTime(.0001,t+.4);
      src.connect(lp);lp.connect(g);g.connect(ctx.destination);src.start(t);src.stop(t+.45);
    }else if(type==='weatherClear'){
      [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>this.tone(f,t+i*0.12,.4,'sine',.06));
    }else if(type==='bossWarn'){
      // Dramatic descending alarm
      [220,196,174.6,164.8].forEach((f,i)=>this.tone(f,t+i*0.18,.5,'sawtooth',.12));
      setTimeout(()=>{
        if(!this.audioCtx)return;
        const t2=this.audioCtx.currentTime;
        [220,196,174.6,164.8].forEach((f,i)=>this.tone(f,t2+i*0.18,.5,'sawtooth',.12));
      },900);
    }else if(type==='bossWin'){
      [523.25,659.25,783.99,1046.5,783.99,1046.5,1318.5].forEach((f,i)=>
        this.marimba(f,t+i*0.1,0.14));
    }else if(type==='heart'){
      // Warm ascending chord
      [392,523.25,659.25,783.99].forEach((f,i)=>this.tone(f,t+i*0.06,.5,'sine',.1));
    }else if(type==='levi'){
      // Magical sparkle trill
      const sparkle=[1046.5,1318.5,1568,1318.5,1046.5,1318.5,1568,2093];
      sparkle.forEach((f,i)=>this.tone(f,t+i*0.07,.25,'sine',.07));
    }
  }
}

const game=new RescueGame();
