// 14. Operator Display + 2. Athlete Management + 11. Round Management
function postSetupAthleteToolsHTML(){
  const part=STATE.participation||"INDIVIDUAL";
  if(part==="INDIVIDUAL") return `<div class="postSetupAthleteTools"><input id="postSetupName" placeholder="Nom et prénom du nouvel athlète"><input id="postSetupClub" placeholder="Club"><button class="btn primary" onclick="addAthleteAfterSetup()">＋ ADD ATHLETE</button></div>`;
  const n=part==="DUO"?2:3;
  const members=Array.from({length:n},(_,i)=>`<div class="memberCell"><input id="postSetupName${i}" placeholder="${part==="DUO"?`Athlète ${i+1}`:`Membre ${i+1}`} — nom et prénom">${part==="DUO"?`<select id="postSetupGender${i}"><option value="">Sexe</option><option value="Male">Male</option><option value="Female">Female</option></select>`:''}</div>`).join("");
  return `<div class="postSetupAthleteTools groupPostSetup"><div class="groupPostMembers">${members}</div><input id="postSetupClub" placeholder="Club / Équipe"><button class="btn primary" onclick="addAthleteAfterSetup()">＋ ADD ${part}</button></div>`;
}

let operatorAudioContext=null;
function ensureOperatorAudio(){
  if(operatorAudioContext){try{operatorAudioContext.resume();}catch(_){ } return operatorAudioContext;}
  try{operatorAudioContext=new (window.AudioContext||window.webkitAudioContext)(); operatorAudioContext.resume();}catch(_){operatorAudioContext=null;}
  return operatorAudioContext;
}
function toggleCompetitionSound(){
  STATE.audioEnabled=STATE.audioEnabled!==false; STATE.audioEnabled=!STATE.audioEnabled;
  if(STATE.audioEnabled)ensureOperatorAudio();
  saveState(); render();
}
function playCompetitionSound(kind){
  if(STATE.audioEnabled===false)return;
  const ctx=ensureOperatorAudio(); if(!ctx)return;
  const patterns={
    start:[[660,.11,0],[880,.14,.13]],
    calc:[[740,.10,0],[740,.10,.14]],
    judge:[[880,.08,0],[1046,.12,.10]],
    result:[[523,.10,0],[659,.10,.12],[784,.18,.24]],
    tiebreak:[[494,.12,0],[659,.12,.14],[988,.20,.28]],
    finish:[[784,.10,0],[988,.10,.12],[1318,.24,.24]]
  };
  const now=ctx.currentTime;
  (patterns[kind]||patterns.result).forEach(([freq,dur,delay])=>{
    const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=freq;
    g.gain.setValueAtTime(.0001,now+delay); g.gain.exponentialRampToValueAtTime(.16,now+delay+.015); g.gain.exponentialRampToValueAtTime(.0001,now+delay+dur);
    o.connect(g).connect(ctx.destination); o.start(now+delay); o.stop(now+delay+dur+.02);
  });
}

function resultsButtonHTML(){
  return ((STATE.phase==="FINAL"||STATE.phase==="DIRECT FINAL") && allAthletesFinalized() && !hasTie()) ? `<button class="btn" onclick="showResults()">RESULTS</button>` : '';
}
function normalizeAthleteText(){
  (STATE.athletes||[]).forEach(a=>{
    if(a.name)a.name=String(a.name).toUpperCase();
    if(a.club)a.club=String(a.club).toUpperCase();
    if(Array.isArray(a.members)) a.members.forEach(m=>{if(m?.name)m.name=String(m.name).toUpperCase()});
  });
}

function judgeConnectionStatusHTML(){return `<div class="operatorJudgeStatus"><div class="phaseTag">JUDGES CONNECTION</div><div class="operatorJudgeStatusGrid">${Array.from({length:Number(STATE.judgeCount||0)},(_,i)=>{const j=i+1;const c=judgeConnections?.[j]?.open;const score=!!STATE.judgeQr?.scores?.[j];const name=STATE.judgeNames?.[j]||"NAME NOT SET";return `<div class="operatorJudgeStatusItem ${c?'online':''} ${score?'scored':''}" data-judge="${j}"><b>J${j}</b><div class="operatorJudgeIdentity"><strong>${esc(name)}</strong><span>${score?'SCORE RECEIVED':c?'CONNECTED':'WAITING'}</span></div></div>`}).join('')}</div></div>`}
function showCurrentRanking(){if(!STATE.setupComplete)return;STATE.rankingReturnMode=STATE.publicMode||'ready';STATE.currentRankingVisible=true;STATE.publicMode='ranking';computeRanking();broadcast();render();openCurrentRankingModal();}
function closeCurrentRanking(){STATE.currentRankingVisible=false;STATE.publicMode=STATE.rankingReturnMode||'ready';delete STATE.rankingReturnMode;broadcast();document.getElementById('currentRankingOverlay')?.remove();render();}
function openCurrentRankingModal(){const old=document.getElementById('currentRankingOverlay');if(old)old.remove();const list=computeRanking().filter(x=>!x.absent);const ov=document.createElement('div');ov.id='currentRankingOverlay';ov.className='currentRankingOverlay';ov.innerHTML=`<div class="currentRankingModal"><header><div><div class="phaseTag">LIVE STANDINGS</div><h2>CURRENT RANKING</h2><p>Classement actuel uniquement — la compétition continue normalement.</p></div><button class="btn" onclick="closeCurrentRanking()">CLOSE</button></header><div class="currentRankingList">${list.length?rankingHTML(list):'<div class="rankingEmpty">NO FINAL SCORES YET</div>'}</div></div>`;document.body.appendChild(ov);}
function showCurrentRankingIfNeeded(){if(STATE.currentRankingVisible && !document.getElementById('currentRankingOverlay'))openCurrentRankingModal();}
function renderOperator(){
 normalizeAthleteText();
 if(!STATE.setupComplete){document.body.innerHTML=landingScreen("operator");return;}
 if(!STATE.competitionStarted){
   const fixed=STATE.fixedPoomsae||{};
   const set=STATE.phase==="SEMI-FINAL"?(fixed.semi||{}):(fixed.final||fixed);
   const names=STATE.athletes.map((a,i)=>`<div class="setupOverviewAth"><b>${i+1}</b><span>${esc(a.name)}</span><small>${esc(a.club)}</small><button class="btn danger smallBtn" onclick="deleteAthleteSafe(${i})">DELETE</button></div>`).join("");
   document.body.innerHTML=`<div class="app"><header class="topbar"><div class="brand"><img class="topFedLogo" src="federation_logo_transparent.png" alt="Fédération Tunisienne de Taekwondo"><span class="mini-art" aria-hidden="true">🥋</span> FTT <span>POOMSAE</span> SCORING</div><div class="actions"><button class="btn" onclick="backToInitialSetup()">← BACK TO SETUP</button><button class="btn primary" onclick="openPublicDisplay()">OPEN PUBLIC DISPLAY</button>${resultsButtonHTML()}<span class="appSignature" aria-label="A.N signature">A.N</span></div></header><main class="setupOverview"><div class="card overviewCard"><div class="phaseTag">COMPETITION READY</div><h1>${esc(STATE.competitionName)}</h1><div class="overviewMeta"><span><b>CLASS</b>${esc(STATE.classCode)}</span><span><b>CATEGORY</b>${esc(STATE.category)}</span>${STATE.participation!=="DUO"?`<span><b>SEXE</b>${esc(STATE.gender||"—")}</span>`:""}<span><b>PARTICIPATION</b>${esc(STATE.participation||"INDIVIDUAL")}</span><span><b>ATHLETES</b>${STATE.athletes.length}</span><span><b>JUDGES</b>${STATE.judgeCount}</span><span><b>TAPIS</b>${esc(STATE.matNumber||1)}</span><span><b>PHASE</b>${esc(STATE.phase)}</span></div><div class="overviewPoomsae"><div><b>${STATE.phase==="SEMI-FINAL"?"DEMI-FINALE":"FINALE"}</b><span>ROUND 1 · ${esc(WT_DATA.poomsae[set.round1]||"—")}</span><span>ROUND 2 · ${esc(WT_DATA.poomsae[set.round2]||"—")}</span></div>${STATE.phase==="SEMI-FINAL"?`<div><b>FINALE</b><span>ROUND 1 · ${esc(WT_DATA.poomsae[fixed.final?.round1]||"—")}</span><span>ROUND 2 · ${esc(WT_DATA.poomsae[fixed.final?.round2]||"—")}</span></div>`:""}</div><div class="overviewAthletes"><h2>ATHLETES</h2>${names}</div>${postSetupAthleteToolsHTML()}<button class="btn success launchCompetitionBtn" onclick="startCompetition()">▶ COMMENÇONS LA COMPÉTITION</button></div></main></div>`;
   return;
 }
 document.body.innerHTML=`<div class="app"><header class="topbar"><div class="brand"><img class="topFedLogo" src="federation_logo_transparent.png" alt="Fédération Tunisienne de Taekwondo"><span class="mini-art" aria-hidden="true">🥋</span> FTT <span>POOMSAE</span> SCORING</div><div class="actions"><button class="btn" onclick="backToInitialSetup()">← BACK TO SETUP</button><button class="btn primary" onclick="openPublicDisplay()">OPEN PUBLIC DISPLAY</button><button class="btn judgeQrButton" onclick="openJudgesQR()">JUDGES QR</button><button class="btn" onclick="openCollectorQR()">COLLECTOR QR</button><button class="btn" onclick="showCurrentRanking()">CURRENT RANKING</button><button class="btn soundToggle" onclick="toggleCompetitionSound()">🔊 ${STATE.audioEnabled===false?"SOUND OFF":"SOUND ON"}</button>${resultsButtonHTML()}<button class="btn" onclick="document.documentElement.requestFullscreen?.()">FULLSCREEN</button><span class="appSignature" aria-label="A.N signature">A.N</span></div></header><main class="layout singleOperator"><aside><div class="card athleteFixedCard"><div class="sectionHeader"><div><div class="phaseTag">LOCKED COMPETITION</div><h2>${esc(STATE.competitionName)}</h2><p class="muted">${esc(STATE.phase)} · Class ${esc(STATE.classCode)} · ${esc(STATE.category)}${STATE.participation!=="DUO"&&STATE.gender?` · ${esc(STATE.gender)}`:""} · ${esc(STATE.participation||"INDIVIDUAL")}</p><p class="muted">Round 1: <b>${esc(WT_DATA.poomsae[((STATE.phase==="SEMI-FINAL"?(STATE.fixedPoomsae?.semi||{}):(STATE.fixedPoomsae?.final||{})).round1)||STATE.fixedPoomsae?.round1]||"—")}</b> · Round 2: <b>${esc(WT_DATA.poomsae[((STATE.phase==="SEMI-FINAL"?(STATE.fixedPoomsae?.semi||{}):(STATE.fixedPoomsae?.final||{})).round2)||STATE.fixedPoomsae?.round2]||"—")}</b></p></div></div><hr><div id="athletes"></div>${postSetupAthleteToolsHTML()}</div></aside><section id="mainPanel"></section></main></div>`;
 renderMainPanel();
}
function startCompetition(){
 if(!STATE.setupComplete)return;
 STATE.competitionStarted=true;
 STATE.currentIndex=STATE.athletes.findIndex(a=>!a.absent);
 if(STATE.currentIndex<0)STATE.currentIndex=0;
 STATE.currentRound=1;
 STATE.state=STATES.ATHLETE_READY;
 STATE.publicMode="ready";
 STATE.publishedResult=null;
 STATE.timer={elapsed:0,running:false,expired:false};
 logEvent("COMPETITION_STARTED",{message:"Competition started"});
 saveState();broadcast();render();
}
function nextAvailableAthlete(){
 const idx=STATE.athletes.findIndex(x=>!x.absent && x.rounds.length<2);
 if(idx>=0){STATE.currentIndex=idx;STATE.currentRound=Math.min(STATE.athletes[idx].rounds.length+1,2);STATE.state=STATE.currentRound===2?STATES.ROUND_2_READY:STATES.ATHLETE_READY;STATE.publicMode="ready";STATE.publishedResult=null;resetTimer();broadcast();render();}else{if(STATE.phase==="SEMI-FINAL"){STATE.publicMode="qualified";STATE.state=STATES.QUALIFIED;}else{STATE.publicMode="qualified";STATE.state=STATES.QUALIFIED;}broadcast();render();}
}
function updatePoomsae(){
 const fixed=STATE.fixedPoomsae||{};
 const p=fixed[`round${STATE.currentRound}`];
 return p||"";
}
function currentRoundPoomsae(){
 if(STATE.tieBreak?.active && Number(STATE.currentRound)===3)return STATE.tieBreak.poomsae||"";
 const fixed=STATE.fixedPoomsae||{};
 const set=(STATE.phase==="SEMI-FINAL"?fixed.semi:fixed.final)||fixed;
 const fixedKey=set[`round${STATE.currentRound}`]||fixed[`round${STATE.currentRound}`];
 if(fixedKey)return fixedKey;
 const a=currentAthlete();return a?.rounds?.[STATE.currentRound-1]?.poomsae||""
}
function selectRoundPoomsae(value){
 const fixed=STATE.fixedPoomsae||{};
 const expected=fixed[`round${STATE.currentRound}`];
 if(expected && value!==expected)return alert("La Poomsae est fixée dans le Competition Setup et ne peut pas être modifiée.");
 const a=currentAthlete();if(!a)return;
 a.rounds[STATE.currentRound-1]=a.rounds[STATE.currentRound-1]||{};
 a.rounds[STATE.currentRound-1].poomsae=expected||value;
 saveState();broadcast();render();
}
function saveControl(){
 STATE.competitionName=document.getElementById("competitionName").value.trim()||"WT POOMSAE COMPETITION";
 STATE.athleteCount=Number(document.getElementById("athleteCount").value)||1;STATE.phase=(STATE.participation==="INDIVIDUAL" ? (STATE.athleteCount<=8?"DIRECT FINAL":"SEMI-FINAL") : (STATE.athleteCount<=4?"DIRECT FINAL":"SEMI-FINAL"));STATE.classCode=document.getElementById("classCode").value;STATE.category=document.getElementById("category").value;STATE.gender=document.getElementById("gender").value;
 STATE.judgeCount=Number(document.getElementById("judgeCount").value);
 updatePoomsae();broadcast();render();
}
function addAthlete(){
 // IMPORTANT: read the athlete fields BEFORE saveControl(), because saveControl() re-renders the form.
 const nameEl=document.getElementById("athleteName");
 const clubEl=document.getElementById("athleteClub");
 const name=(nameEl?.value.trim()||"").toUpperCase();
 const club=(clubEl?.value.trim()||"").toUpperCase();
 if(!name||!club){nameEl?.classList.toggle("invalid-athlete",!name);clubEl?.classList.toggle("invalid-athlete",!club);return false;}
 const maxAthletes=Number(document.getElementById("athleteCount")?.value)||STATE.athleteCount||8;
 if(STATE.athletes.length>=maxAthletes)return alert(`La catégorie est configurée pour ${maxAthletes} athlète(s).`);
 // Save current competition controls without re-rendering them.
 STATE.competitionName=document.getElementById("competitionName").value.trim()||"WT POOMSAE COMPETITION";
 STATE.athleteCount=Number(document.getElementById("athleteCount").value)||1;
 STATE.phase=(STATE.participation==="INDIVIDUAL" ? (STATE.athleteCount<=8?"DIRECT FINAL":"SEMI-FINAL") : (STATE.athleteCount<=4?"DIRECT FINAL":"SEMI-FINAL"));
 STATE.classCode=document.getElementById("classCode").value;
 STATE.category=document.getElementById("category").value;
 STATE.gender=document.getElementById("gender").value;
 STATE.judgeCount=Number(document.getElementById("judgeCount").value);
 
 STATE.athletes.push({id:crypto.randomUUID?.()||String(Date.now()+Math.random()),name,club,gender:STATE.gender,rounds:[],finalScore:null});
 logEvent("ATHLETE_ADDED",{name,message:`${name} added`});
 saveState();
 broadcast();
 render();
}
function selectAthlete(i){
 const athlete=STATE.athletes[i];
 if(!athlete)return;
 if(athlete.absent)return alert("Cet athlète est marqué ABSENT.");
 if((athlete.rounds||[]).length>=2 && Number.isFinite(athlete.finalScore)){
   STATE.currentIndex=i;STATE.currentRound=2;STATE.state=STATES.FINAL_RESULT;STATE.publicMode="final";STATE.publishedResult=null;computeRanking();broadcast();render();return;
 }
 STATE.currentIndex=i;STATE.currentRound=Math.min((athlete.rounds||[]).length+1,2);STATE.state=STATE.currentRound===2?STATES.ROUND_2_READY:STATES.ATHLETE_READY;STATE.publicMode="ready";STATE.publishedResult=null;resetTimer();broadcast();render()
}
function athleteListHTML(){return STATE.athletes.map((a,i)=>{const status=a.absent?"ABSENT":(a.finalScore!=null?"COMPLETED":(i===STATE.currentIndex?"IN PROGRESS":"WAITING"));const locked=STATE.competitionStarted&&i===STATE.currentIndex&&[STATES.ROUND_RUNNING,STATES.TIME_FINISHED,STATES.CALCULATING].includes(STATE.state);return `<div class="athleteRow ${i===STATE.currentIndex?"selected":""} ${a.absent?"absentRow":""}"><span><b>${i+1}. ${esc(a.name)}</b><small>${esc(a.club)} · ${status}</small></span><div class="athleteRowActions"><button class="btn" onclick="selectAthlete(${i})">${a.absent?"VIEW":"SELECT"}</button><button class="btn danger smallBtn" ${locked?"disabled title=\"Cannot delete athlete during active scoring\"":""} onclick="deleteAthleteSafe(${i})">DELETE</button></div></div>`}).join("")||"<p class='muted'>No athletes.</p>"}
function addAthleteAfterSetup(){
 const part=STATE.participation||"INDIVIDUAL";
 let entry;
 if(part==="INDIVIDUAL"){
   const nameEl=document.getElementById("postSetupName"),clubEl=document.getElementById("postSetupClub");
   const name=(nameEl?.value.trim()||"").toUpperCase(),club=(clubEl?.value.trim()||"").toUpperCase();
   if(!name){nameEl?.classList.add("invalid-athlete");nameEl?.focus();return false;}
   if(!club){clubEl?.classList.add("invalid-athlete");clubEl?.focus();return false;}
   nameEl.classList.remove("invalid-athlete");clubEl.classList.remove("invalid-athlete");
   if(STATE.athletes.some(a=>String(a.name||"").toLowerCase()===name.toLowerCase())){nameEl.classList.add("invalid-athlete");return false;}
   entry={name,club,gender:STATE.gender};
 }else{
   const n=part==="DUO"?2:3; const members=[];
   for(let i=0;i<n;i++){
     const nameEl=document.getElementById(`postSetupName${i}`);
     const genderEl=part==="DUO"?document.getElementById(`postSetupGender${i}`):null;
     const name=(nameEl?.value.trim()||"").toUpperCase(),gender=part==="DUO"?(genderEl?.value||""):STATE.gender;
     nameEl?.classList.toggle("invalid-athlete",!name);genderEl?.classList.toggle("invalid-athlete",part==="DUO"&&!gender);if(!name||!gender)return false;members.push({name,gender});
   }
   const clubEl=document.getElementById("postSetupClub"),club=(clubEl?.value.trim()||"").toUpperCase();clubEl?.classList.toggle("invalid-athlete",!club);if(!club)return false;
   if(part==="DUO" && members[0].gender===members[1].gender){members.forEach((_,i)=>document.getElementById(`postSetupGender${i}`)?.classList.add("invalid-athlete"));return false;}
   const allExistingNames=new Set(STATE.athletes.flatMap(a=>a.members?.map(m=>m.name.toLowerCase())||[String(a.name||"").toLowerCase()]));
   if(members.some(m=>allExistingNames.has(m.name.toLowerCase()))){members.forEach((m,i)=>{if(allExistingNames.has(m.name.toLowerCase()))document.getElementById(`postSetupName${i}`)?.classList.add("invalid-athlete")});return false;}
   entry={members,club,name:members.map(m=>m.name).join(" / "),gender:part==="DUO"?"Mixed":members[0].gender};
 }
 STATE.athletes.push({id:crypto.randomUUID?.()||String(Date.now()+Math.random()),name:entry.name,club:entry.club,gender:entry.gender,participation:part,members:entry.members||null,matNumber:STATE.matNumber,absent:false,rounds:[],finalScore:null});
 logEvent("ATHLETE_ADDED",{name:entry.name,message:`${entry.name} added`});
 STATE.athleteCount=STATE.athletes.length;
 const threshold=part==="INDIVIDUAL"?8:4; if(!STATE.competitionStarted) STATE.phase=STATE.athleteCount<=threshold?"DIRECT FINAL":"SEMI-FINAL";
 saveState();broadcast();render();return true;
}
function removeAthlete(i){
 if(i<0||i>=STATE.athletes.length)return false;
 const removed=STATE.athletes[i];
 if(STATE.competitionStarted && i===STATE.currentIndex && [STATES.ROUND_RUNNING,STATES.TIME_FINISHED,STATES.CALCULATING].includes(STATE.state))return false;
 STATE.athletes.splice(i,1);
 logEvent("ATHLETE_DELETED",{name:removed?.name||"",message:`${removed?.name||"Athlete"} deleted`});
 STATE.athleteCount=STATE.athletes.length;
 if(STATE.currentIndex>=STATE.athletes.length)STATE.currentIndex=Math.max(0,STATE.athletes.length-1);
 if(removed?.id&&STATE.tieResolutions){Object.keys(STATE.tieResolutions).forEach(k=>{if(k.includes(removed.id))delete STATE.tieResolutions[k]})}
 saveState();broadcast();render();return true;
}
function tieBreakHTML(){
 const pairs=unresolvedTiePairs();
 if(!pairs.length)return "";
 const [a,b]=pairs[0];
 const aAll=noExtremesFinal(a), bAll=noExtremesFinal(b);
 return `<div class="tieBreakPanel"><div class="phaseTag">ÉGALITÉ · TIE-BREAK</div><h2>Égalité persistante</h2><p class="muted">Final Score → Presentation Average → Final Score recalculé avec toutes les notes. Les deux athlètes doivent maintenant effectuer un Poomsae supplémentaire choisi automatiquement.</p><div class="tieBreakPair"><div><b>${esc(a.name)}</b><span>${fmt3(a.finalScore)} · Prés. ${fmt1Public(a.presentationAverage||presentationGeneral(a))} · Toutes notes ${fmt3(aAll)}</span></div><strong>VS</strong><div><b>${esc(b.name)}</b><span>${fmt3(b.finalScore)} · Prés. ${fmt1Public(b.presentationAverage||presentationGeneral(b))} · Toutes notes ${fmt3(bAll)}</span></div></div><button class="btn goldBtn tieBtn" onclick="startTieBreak('${a.id}','${b.id}')">⚡ START TIE-BREAK</button></div>`;
}
function randomTieBreakPoomsae(exclude=""){
 const list=allowedPoomsae(STATE.classCode,STATE.category).filter(Boolean);
 const pool=list.filter(x=>x!==exclude);
 const choices=pool.length?pool:list;
 return choices[Math.floor(Math.random()*choices.length)]||"P1";
}
function startTieBreak(aId,bId){
 if(!allAthletesFinalized())return false;
 const a=STATE.athletes.find(x=>x.id===aId),b=STATE.athletes.find(x=>x.id===bId);
 if(!a||!b)return false;
 STATE.tieBreak={active:true,athleteIds:[aId,bId],poomsae:randomTieBreakPoomsae(STATE.tieBreak?.poomsae||""),stage:"FIRST",scores:{}};
 STATE.currentIndex=STATE.athletes.findIndex(x=>x.id===aId);STATE.currentRound=3;
 STATE.state=STATES.TIE_BREAK_READY;STATE.publicMode="tie";STATE.publishedResult=null;STATE.timer={elapsed:0,running:false,expired:false};
 logEvent("TIE_BREAK_STARTED",{name:`${a.name} / ${b.name}`,message:`Poomsae ${WT_DATA.poomsae[STATE.tieBreak.poomsae]||STATE.tieBreak.poomsae}`});
 saveState();broadcast();judgeSendContext({scoringOpen:false});render();return true;
}
function finishTieBreak(){
 const ids=STATE.tieBreak?.athleteIds||[], scores=STATE.tieBreak?.scores||{};
 if(ids.length!==2||!scores[ids[0]]||!scores[ids[1]])return false;
 const a=STATE.athletes.find(x=>x.id===ids[0]),b=STATE.athletes.find(x=>x.id===ids[1]);
 const sa=Number(scores[ids[0]].total),sb=Number(scores[ids[1]].total);
 if(Math.abs(sa-sb)<=0.0005){
   const next=randomTieBreakPoomsae(STATE.tieBreak.poomsae);
   STATE.tieBreak={active:true,athleteIds:ids,poomsae:next,stage:"FIRST",scores:{}};
   STATE.currentIndex=STATE.athletes.findIndex(x=>x.id===ids[0]);STATE.currentRound=3;STATE.state=STATES.TIE_BREAK_READY;STATE.publicMode="tie";STATE.publishedResult=null;
   logEvent("TIE_BREAK_REPEATED",{name:`${a?.name||''} / ${b?.name||''}`,message:`Égalité sur ${WT_DATA.poomsae[STATE.tieBreak.poomsae]||STATE.tieBreak.poomsae}; nouveau Poomsae ${WT_DATA.poomsae[next]||next}`});
   saveState();broadcast();judgeSendContext({scoringOpen:false});render();return true;
 }
 const winner=sa>sb?a:b,loser=sa>sb?b:a;
 resolveTieBreakWinner(winner.id,loser.id,"poomsae_tie_break");
 STATE.tieBreak.active=false;STATE.state=STATES.FINAL_RESULT;STATE.publicMode="final";STATE.currentIndex=STATE.athletes.findIndex(x=>x.id===winner.id);STATE.currentRound=2;STATE.publishedResult=null;
 saveState();broadcast();judgeSendContext({scoringOpen:false});render();return true;
}

function renderMainPanel(){
 const list=document.getElementById("athletes");if(list)list.innerHTML=athleteListHTML();
 const el=document.getElementById("mainPanel");if(!el)return;
 if(STATE.state===STATES.RESULTS){renderResultsView(el);return;}
 const a=currentAthlete();
 if(STATE.state===STATES.QUALIFIED){ const q=qualifiedParticipants(); el.innerHTML=`<div class="card qualifiedCard"><div class="phaseTag">SEMI-FINAL · QUALIFIED</div><h1>${q.length} QUALIFIÉ${q.length>1?'S':''} POUR LA FINALE</h1><div class="qualifiedGrid">${q.map((x,i)=>`<div class="qualifiedRow"><b>#${i+1}</b><span>${esc(x.name)}${x.wonByPresentation?`<small class="presentationTieRemark">WIN BY PRESENTATION NOTE</small>`:""}<small>${esc(x.club)}</small></span><strong>${fmt3(x.finalScore)}</strong></div>`).join('')}</div>${tieBreakHTML()}<div class="actions bigActions"><button class="btn success" onclick="prepareFinal()" ${allAthletesFinalized()&&!hasTie()?'':'disabled'}>PREPARE FINAL · TOP ${qualifiedCount()}${allAthletesFinalized()&&!hasTie()?'':' 🔒'}</button></div></div>`; return; }
 if(STATE.state===STATES.PODIUM){ el.innerHTML=`<div class="card podiumCard"><div class="phaseTag">FINAL CLASSIFICATION</div><h1>Champions Podium</h1>${podiumHTML()}</div>`; return; }
 if(!a){el.innerHTML=`<div class="card hero"><h1>READY</h1><p>Add athletes and select one to begin.</p></div>`;return}
 const allowed=allowedPoomsae(STATE.classCode,STATE.category);
 const selectedPoomsae=currentRoundPoomsae();
 const canCalculate=STATE.state===STATES.ROUND_RUNNING||STATE.state===STATES.TIME_FINISHED;
 const roundHistory=(a.rounds||[]).map((r,i)=>{
   const penaltyCount=Number.isFinite(Number(r?.penaltyCount))?Number(r.penaltyCount):Math.round((Number(r?.penalty)||0)/0.3);
   const penaltyValue=penaltyCount*0.3;
   return `<div class="roundHistoryItem"><div class="roundHistoryMain"><span>ROUND ${i+1} · ${esc(WT_DATA.poomsae[r.poomsae]||r.poomsae||"—")}</span><strong>${fmt3(r.total)}</strong><small>Accuracy ${fmt3(r.accuracy)} · Presentation ${fmt3(r.presentation)}${penaltyCount?` · Penalties -${fmt3(penaltyValue)}`:""} · <span class="roundValidMark">✓ VALIDÉ</span></small></div><div class="penaltyControl" aria-label="Penalties for round ${i+1}"><span>PENALTIES</span><button class="btn penaltyBtn" onclick="adjustRoundPenalty(${i},-1)" ${penaltyCount<=0?"disabled":""}>−</button><b>${penaltyCount}</b><button class="btn penaltyBtn" onclick="adjustRoundPenalty(${i},1)">+</button></div></div>`;
 }).join("");
 const historyHTML=roundHistory?`<div class="card roundHistory"><div class="phaseTag">RESULTATS DES ROUNDS</div>${roundHistory}</div>`:"";
 if(STATE.state===STATES.RESULT_READY){
   const last=a.rounds?.[STATE.currentRound-1];
   const isRound2=STATE.currentRound===2;
   el.innerHTML=`<div class="card scoringCard roundResultCard"><div class="kpi"><div>PHASE<b>${esc(STATE.phase)}</b></div><div>ROUND<b>${STATE.currentRound} / 2</b></div><div>JUDGES<b>${STATE.judgeCount}</b></div><div>ROUND SCORE<b>${last?fmt3(last.total):"—"}</b></div></div>
   <div class="current"><div class="athleteProgress">ATHLETE ${STATE.currentIndex+1} / ${STATE.athletes.length}</div><h1>${esc(a.name)}</h1><p>${esc(a.club)} · ${esc(WT_DATA.poomsae[last?.poomsae]||last?.poomsae||"—")}</p></div>
   <div class="calcBadge">ROUND ${STATE.currentRound} RESULT DISPLAYED</div>${historyHTML}
   <div class="actions bigActions">${isRound2?`<button class="btn success" onclick="publishFinalScore()">SHOW FINAL SCORE</button>`:`<button class="btn success" onclick="continueToRound2()">START ROUND 2</button>`}</div></div>`;
   return;
 }
 if([STATES.TIE_BREAK_READY,STATES.TIE_BREAK_RUNNING,STATES.TIE_BREAK_CALCULATING].includes(STATE.state)){
   const tb=STATE.tieBreak||{}, ids=tb.athleteIds||[], ta=ids.map(id=>STATE.athletes.find(x=>x.id===id)).filter(Boolean);
   const p=tb.poomsae, tieCalc=STATE.state===STATES.TIE_BREAK_CALCULATING;
   if(tieCalc){setTimeout(()=>updateJudgeSubmitButton(),0);}
   el.innerHTML=`<div class="card scoringCard tieBreakOperatorCard"><div class="phaseTag">TIE-BREAK · ${tb.stage||""}</div><div class="kpi"><div>ATHLETE<b>${esc(a.name)}</b></div><div>POOMSAE<b>${esc(WT_DATA.poomsae[p]||p)}</b></div><div>JUDGES<b>${STATE.judgeCount}</b></div><div>STATUS<b>${tieCalc?"SCORING":"READY"}</b></div></div><div class="tieBreakAthletesMini">${ta.map(x=>`<span class="${x.id===a.id?"active":""}">${esc(x.name)}${tb.scores?.[x.id]?` · ${fmt3(tb.scores[x.id].total)}`:""}</span>`).join('')}</div>${tieCalc?judgeInputs():`<div class="current tieBreakCurrent"><h1>${esc(a.name)}</h1><p>${esc(a.club)} · <strong>${esc(WT_DATA.poomsae[p]||p)}</strong></p><div class="tiePoomsae">${esc(WT_DATA.poomsae[p]||p)}</div><div class="actions bigActions">${STATE.state===STATES.TIE_BREAK_RUNNING?(STATE.timer?.running?`<button class="btn" onclick="pausePerformance()">PAUSE TIMER</button>`:`<button class="btn success" onclick="resumePerformance()">RESUME TIMER</button>`):`<button class="btn success" onclick="startPerformance()">START TIE-BREAK PERFORMANCE</button>`}<button class="btn primary" onclick="calculateState()" ${STATE.state===STATES.TIE_BREAK_RUNNING?"":"disabled"}>CALCULATING RESULTS</button></div></div>`}</div>`;
   return;
 }
 if(STATE.state===STATES.FINAL_RESULT){
   const ranking=computeRanking();
   const current=ranking.find(x=>x.id===a.id);
   const r1=a.rounds?.[0],r2=a.rounds?.[1];
   const finalVisible=Number.isFinite(a.finalScore);
   el.innerHTML=`<div class="card scoringCard finalScoreCard"><div class="kpi"><div>PHASE<b>${esc(STATE.phase)}</b></div><div>ROUNDS<b>2 / 2</b></div><div>FINAL SCORE<b>${finalVisible?fmt3(a.finalScore):"—"}</b></div><div>CURRENT RANK<b>${current?.position||"—"}</b></div></div>
   <div class="current"><div class="athleteProgress">ATHLETE ${STATE.currentIndex+1} / ${STATE.athletes.length}</div><h1>${esc(a.name)}</h1><p>${esc(a.club)}</p></div>
   <div class="finalBreakdown"><div><span>ROUND 1</span><strong>${r1?fmt3(r1.total):"—"}</strong></div><div><span>ROUND 2</span><strong>${r2?fmt3(r2.total):"—"}</strong></div><div><span>FINAL = (R1 + R2) / 2</span><strong>${finalVisible?fmt3((r1.total+r2.total)/2):"—"}</strong></div></div>
   ${historyHTML}<div class="roundValidatedBadge">✓ ROUNDS VALIDATED</div>${finalVisible?`<div class="finalPublished"><b>FINAL SCORE PUBLISHED</b><span>${fmt3(a.finalScore)} · CURRENT RANK #${current?.position||"—"}</span></div>`:`<div class="calcBadge">ROUND 2 COMPLETE — READY TO PUBLISH THE FINAL SCORE</div>`}
   ${finalVisible&&allAthletesFinalized()&&hasTie()?tieBreakHTML():""}
   <div class="actions bigActions">${finalVisible?`${STATE.phase==="SEMI-FINAL"?(allAthletesFinalized()&&!hasTie()?`<button class="btn primary" onclick="showQualified()">SHOW ${qualifiedCount()} QUALIFIED</button>`:""):(allAthletesFinalized()&&!hasTie()?`<button class="btn goldBtn" onclick="showPodium()">FINAL PODIUM</button>`:"")}${hasNextAthlete()?`<button class="btn" onclick="nextAthlete()">NEXT ATHLETE</button>`:""}`:`<button class="btn success" onclick="publishFinalScore()">SHOW FINAL SCORE</button>`}</div></div>`;
   return;
 }
 if(STATE.state===STATES.CALCULATING){
   el.innerHTML=`<div class="card scoringCard"><div class="kpi"><div>PHASE<b>${esc(STATE.phase)}</b></div><div>ROUND<b>${STATE.currentRound}</b></div><div>JUDGES<b>${STATE.judgeCount}</b></div><div>TAPIS<b>${STATE.matNumber||1}</b></div><div>TIMER<b>${fmtTime(remainingTime())}</b></div></div>
   <div class="current"><h1>${esc(a.name)}</h1><p>${esc(a.club)} · ${esc(WT_DATA.poomsae[selectedPoomsae]||"—")}</p></div>
   <div class="calcBadge">CALCULATING RESULTS — JUDGES SCORES</div>
   ${historyHTML}${judgeConnectionStatusHTML()}${judgeInputs()}</div>`;
   setTimeout(()=>updateJudgeSubmitButton(),0);
   return;
 }
 el.innerHTML=`<div class="card"><div class="kpi"><div>PHASE<b>${esc(STATE.phase)}</b></div><div>ROUND<b>${STATE.currentRound}</b></div><div>JUDGES<b>${STATE.judgeCount}</b></div><div>TAPIS<b>${STATE.matNumber||1}</b></div><div>TIMER<b>${fmtTime(remainingTime())}</b></div></div>
 <div class="current"><div class="athleteProgress">ATHLETE ${STATE.currentIndex+1} / ${STATE.athletes.length}</div><h1>${esc(a.name)}</h1><p>${esc(a.club)}</p></div>
 <div class="poomsaeSelect fixedPoomsae"><label>POOMSAE — ROUND ${STATE.currentRound}<input value="${esc(WT_DATA.poomsae[selectedPoomsae]||"—")}" readonly></label><small>FIXED BY COMPETITION SETUP • NON MODIFIABLE</small></div>
 ${historyHTML}${judgeConnectionStatusHTML()}<div class="actions bigActions">${STATE.state===STATES.ROUND_RUNNING?(STATE.timer?.running?`<button class="btn" onclick="pausePerformance()">PAUSE TIMER</button>`:`<button class="btn success" onclick="resumePerformance()">RESUME TIMER</button>`):`<button class="btn success" onclick="startPerformance()">START ROUND ${STATE.currentRound}</button>`}<button class="btn" onclick="resetPerformanceTimer()">RESET TIMER</button><button class="btn primary" onclick="calculateState()" ${canCalculate?"":"disabled"}>CALCULATING RESULTS</button></div></div>`;
}
function scoreInput(id,label,min,max,placeholder){return `<label>${label}<input id="${id}" type="number" min="${min}" max="${max}" step="any" inputmode="decimal" placeholder="${placeholder}" oninput="validateScoreField(this,${min},${max});updateJudgeSubmitButton?.()" onkeydown="scoreArrowAdjust(event,this,${min},${max})"></label>`}
function judgeStatusHTML(){return `<div class="judgeStatusBar">${Array.from({length:STATE.judgeCount},(_,i)=>`<span id="judgeStatus${i}" class="judgeStatus waiting">J${i+1} ⏳</span>`).join("")}</div>`}
function scoreInputValue(id,label,min,max,placeholder,value){return `<label>${label}<input id="${id}" type="number" min="${min}" max="${max}" step="any" inputmode="decimal" placeholder="${placeholder}" value="${value!=null?value:""}" oninput="validateScoreField(this,${min},${max});updateJudgeSubmitButton?.()" onkeydown="scoreArrowAdjust(event,this,${min},${max})"></label>`}
function judgeInputs(){const remote=STATE.judgeQr?.scores||{};return `${judgeStatusHTML()}<div class="judgeGrid">${Array.from({length:STATE.judgeCount},(_,i)=>{const s=remote[i+1]||{};const judgeName=STATE.judgeNames?.[i+1]||"NAME NOT SET";return `<div class="judgeBox"><b>JUDGE ${i+1}</b><small class="operatorJudgeName">${esc(judgeName)}</small>${scoreInputValue(`acc${i}`,"Accuracy",0,4,"3.3",s.accuracy!=null?Number(s.accuracy).toFixed(1):"")}${scoreInputValue(`pres${i}`,"Presentation",1.5,6,"4.2",s.presentation!=null?Number(s.presentation).toFixed(1):"")}</div>`}).join("")}</div><div class="actions bigActions"><button id="sendResultBtn" class="btn success" disabled onclick="sendResult()">SHOW RESULTS</button></div>`}

function validateScoreField(el,min,max){const raw=String(el.value).trim().replace(",",".");const n=Number(raw);const valid=raw!==""&&Number.isFinite(n)&&n>=min&&n<=max;el.classList.toggle("invalid-score",!valid);el.classList.toggle("valid-score",valid);return valid}
function updateJudgeSubmitButton(){const btn=document.getElementById("sendResultBtn");let ok=true;for(let i=0;i<STATE.judgeCount;i++){const a=document.getElementById(`acc${i}`),p=document.getElementById(`pres${i}`);const valid=!!a&&!!p&&validateScoreField(a,0,4)&&validateScoreField(p,1.5,6);const st=document.getElementById(`judgeStatus${i}`);if(st){st.className=`judgeStatus ${valid?"ready":"waiting"}`;st.textContent=`J${i+1} ${valid?"✓":"⏳"}`;}if(!valid)ok=false;}if(btn)btn.disabled=!ok;}
function scoreArrowAdjust(event,el,min,max){if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;event.preventDefault();const current=Number(String(el.value).replace(",","."));const base=Number.isFinite(current)?current:(event.key==="ArrowUp"?min:max);const next=Math.round((base+(event.key==="ArrowUp"?0.1:-0.1))*10)/10;el.value=Math.min(max,Math.max(min,next)).toFixed(1);validateScoreField(el,min,max);el.dispatchEvent(new Event("input",{bubbles:true}));}
function startPerformance(){
 const a=currentAthlete();if(!a)return;const p=currentRoundPoomsae();if(!p)return alert("Sélectionnez la Poomsae avant de démarrer la prestation.");
 const tie=!!STATE.tieBreak?.active&&Number(STATE.currentRound)===3;
 STATE.state=tie?STATES.TIE_BREAK_RUNNING:STATES.ROUND_RUNNING;STATE.publicMode=tie?"tie":"running";STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},sessionId:"",scores:{}};STATE.judgeQr.sessionId=judgeNewSessionId();STATE.judgeQr.scores={};logEvent(tie?"TIE_BREAK_ATHLETE_STARTED":"ROUND_STARTED",{name:a.name,message:`${tie?"Tie-break":"Round "+STATE.currentRound} · ${WT_DATA.poomsae[p]||p}`});broadcast();judgeSendContext();playCompetitionSound(tie?"tiebreak":"start");startTimer();
}
function calculateState(){
 const a=currentAthlete();
 if(!a)return alert("Sélectionnez un athlète.");
 const tie=STATE.state===STATES.TIE_BREAK_RUNNING;
 if(!tie&&STATE.state!==STATES.ROUND_RUNNING&&STATE.state!==STATES.TIME_FINISHED)return alert("La prestation doit être en cours ou avoir atteint 01:30.");
 if(tie===false && STATE.state!==STATES.ROUND_RUNNING && STATE.state!==STATES.TIME_FINISHED)return alert("La prestation doit être en cours ou avoir atteint 01:30.");
 if(!currentRoundPoomsae())return alert("Sélectionnez la Poomsae avant de terminer la prestation.");
 clearInterval(timerInterval);
 STATE.timer.running=false;
 STATE.state=tie?STATES.TIE_BREAK_CALCULATING:STATES.CALCULATING;
 STATE.publicMode=tie?"tie":"calc";
 judgeSendContext({scoringOpen:true});
 playCompetitionSound("calc");
 STATE.publishedResult=null;
 broadcast();
 render();
}
function readJudges(){
 return Array.from({length:STATE.judgeCount},(_,i)=>({accuracy:scoreToNumber(document.getElementById(`acc${i}`).value),presentation:scoreToNumber(document.getElementById(`pres${i}`).value)}));
}
function sendResult(){
 const a=currentAthlete(),judges=readJudges();
 if(judges.some(j=>!validScore(j.accuracy,j.presentation))){updateJudgeSubmitButton();return false;}
 const p=currentRoundPoomsae();if(!p)return alert("Sélectionnez la Poomsae avant de terminer la prestation.");
 const tie=!!STATE.tieBreak?.active&&Number(STATE.currentRound)===3;
 const r=calculateRound(judges,0,!tie);r.round=STATE.currentRound;r.poomsae=p;
 if(tie){
   r.tieBreak=true;r.tieBreakAthleteId=a.id;r.tieBreakAllNotes=true;
   STATE.tieBreak.scores[a.id]=r;
   logEvent("TIE_BREAK_SCORED",{name:a.name,message:`${WT_DATA.poomsae[p]||p} · ${fmt3(r.total)}`});
   const ids=STATE.tieBreak.athleteIds||[];
   const nextId=ids.find(id=>id!==a.id&&!STATE.tieBreak.scores[id]);
   STATE.timer={elapsed:0,running:false,expired:false};
   if(nextId){
     STATE.currentIndex=STATE.athletes.findIndex(x=>x.id===nextId);STATE.tieBreak.stage="SECOND";STATE.judgeQr.sessionId=judgeNewSessionId();STATE.judgeQr.scores={};STATE.state=STATES.TIE_BREAK_READY;STATE.publicMode="tie";STATE.publishedResult=r;saveState();broadcast();judgeSendContext({scoringOpen:false});render();showValidationOverlay();return true;
   }
   finishTieBreak();showValidationOverlay();return true;
 }
 a.rounds[STATE.currentRound-1]=r;
 logEvent("ROUND_SCORED",{name:a.name,message:`Round ${r.round} · ${WT_DATA.poomsae[p]||p} · ${fmt3(r.total)}`});
 if(STATE.currentRound===1){STATE.currentRound=2;STATE.state=STATES.ROUND_2_READY;STATE.publicMode="result";STATE.publishedResult=r}
 else {STATE.state=STATES.RESULT_READY;STATE.publicMode="result";STATE.publishedResult=r;}
 STATE.timer={elapsed:0,running:false,expired:false};
 // Lock the remote Collector after this Poomsae. It will reopen only when the next performance is calculated.
 judgeSendContext({scoringOpen:false,scoreReceived:true,judge:a.id});
 broadcast();render();playCompetitionSound("result");showValidationOverlay();
}
function showValidationOverlay(){
 const old=document.getElementById("validationOverlay"); if(old)old.remove();
 const overlay=document.createElement("div"); overlay.id="validationOverlay"; overlay.className="validationOverlay"; overlay.innerHTML=`<div class="validationGlass"><div class="validationCheck">✓</div><div class="validationText">VALIDÉ</div></div>`;
 document.body.appendChild(overlay);
 setTimeout(()=>{overlay.classList.add("hide");setTimeout(()=>overlay.remove(),450)},2000);
}
function adjustRoundPenalty(roundIndex,delta){
 const a=currentAthlete();
 if(!a||!a.rounds?.[roundIndex])return false;
 const r=a.rounds[roundIndex];
 const current=Number.isFinite(Number(r.penaltyCount))?Number(r.penaltyCount):Math.round((Number(r.penalty)||0)/0.3);
 const next=Math.max(0,current+Number(delta||0));
 r.penaltyCount=next;
 r.penalty=Number((next*0.3).toFixed(3));
 r.total=Number((Number(r.accuracy||0)+Number(r.presentation||0)-r.penalty).toFixed(3));
 if(a.rounds[0]&&a.rounds[1]&&Number.isFinite(a.finalScore)){
   a.finalScore=finalScore(a.rounds[0],a.rounds[1]);
 }
 logEvent("ROUND_PENALTY_UPDATED",{name:a.name,message:`Round ${roundIndex+1} · ${next} penalty(s) · -${fmt3(r.penalty)}`});
 computeRanking();saveState();broadcast();render();
 return true;
}
function continueToRound2(){
 const a=currentAthlete();if(!a||!a.rounds?.[0])return false;
 STATE.currentRound=2;STATE.state=STATES.ROUND_2_READY;STATE.publicMode="ready";STATE.publishedResult=null;
 STATE.timer={elapsed:0,running:false,expired:false};judgeSendContext({scoringOpen:false});broadcast();render();return true;
}
function publishFinalScore(){
 const a=currentAthlete();
 if(!a||!a.rounds?.[0]||!a.rounds?.[1])return alert("Les deux rounds doivent être terminés avant d'afficher la note finale.");
 a.finalScore=finalScore(a.rounds[0],a.rounds[1]);
 logEvent("FINAL_SCORE",{name:a.name,message:`Final ${fmt3(a.finalScore)}`});
 computeRanking();
 STATE.state=STATES.FINAL_RESULT;STATE.publicMode="final";STATE.publishedResult=null;
 broadcast();render();
}
function hasNextAthlete(){
  return STATE.athletes.some((x)=>!x.absent && (x.rounds||[]).length<2);
}
function nextAthlete(){
 const a=currentAthlete();if(!a||a.rounds.length<2)return alert("Terminez les deux rounds.");
 computeRanking();const next=STATE.athletes.findIndex((x,i)=>i>STATE.currentIndex&&!x.absent&&x.rounds.length<2);
 if(next<0){const any=STATE.athletes.findIndex((x)=>!x.absent&&x.rounds.length<2);if(any>=0){STATE.currentIndex=any;STATE.currentRound=Math.min(STATE.athletes[any].rounds.length+1,2);STATE.publishedResult=null;STATE.publicMode="ready";STATE.state=STATES.NEXT_ATHLETE;resetTimer();broadcast();render();return;}
   STATE.publicMode="qualified";STATE.state=STATES.QUALIFIED;broadcast();render();return}
 STATE.currentIndex=next;STATE.currentRound=1;STATE.publishedResult=null;STATE.publicMode="ready";STATE.state=STATES.NEXT_ATHLETE;resetTimer();broadcast();render();
}
function showQualified(){
 if(STATE.phase!=="SEMI-FINAL")return false;
 if(!allAthletesFinalized()||hasTie())return false;
 computeRanking();STATE.publicMode="qualified";STATE.state=STATES.QUALIFIED;broadcast();render();return true;
}
function showPodium(){if(STATE.phase!=="FINAL"&&STATE.phase!=="DIRECT FINAL")return alert("Le podium est disponible uniquement en finale.");if(!allAthletesFinalized())return alert("SHOW FINAL PODIUM est disponible uniquement lorsque tous les athlètes ont reçu leur note finale.");if(hasTie()){return false;}computeRanking();STATE.publicMode="podium";STATE.state=STATES.PODIUM;broadcast();render()}
function prepareFinal(){
 if(STATE.phase!=="SEMI-FINAL")return;
 if(!allAthletesFinalized())return alert("Terminez tous les athlètes du demi-final avant de préparer la finale.");
 const qualifierCount=STATE.participation==="INDIVIDUAL"?8:4;
 const q=computeRanking().filter(x=>!x.absent).slice(0,qualifierCount);
 if(q.length!==qualifierCount)return alert(`La finale exige exactement ${qualifierCount} ${STATE.participation==="DUO"?"duos":"participants"} qualifié(s).`);
 if(STATE.phase==="SEMI-FINAL"){
   STATE.qualifiedSnapshot=q.map(a=>({...a,rounds:(a.rounds||[]).map(r=>({...r})),finalScore:a.finalScore}));
   STATE.phase="FINAL";
   // Final order: last qualifier starts first (8→1 for Individual, 4→1 for Duo/Team).
   STATE.athletes=q.slice().reverse().map(a=>({...a,rounds:[],finalScore:null}));
   const fin=STATE.fixedPoomsae?.final||{};
   STATE.fixedPoomsae={...STATE.fixedPoomsae,round1:fin.round1,round2:fin.round2};
   STATE.currentIndex=0;STATE.currentRound=1;STATE.publicMode="ready";STATE.state=STATES.IDLE;STATE.publishedResult=null;STATE.rankings=[];
   logEvent("SEMI_FINAL_COMPLETED",{message:"Top 8 qualified and finale prepared"});
   broadcast();render();
 }
}
function navigateAthlete(delta){
 const target=STATE.currentIndex+Number(delta||0); if(target<0||target>=STATE.athletes.length)return false;
 const a=STATE.athletes[target]; if(!a||a.absent)return false;
 if([STATES.ROUND_RUNNING,STATES.TIME_FINISHED,STATES.CALCULATING].includes(STATE.state))return false;
 STATE.currentIndex=target;STATE.currentRound=Math.min((a.rounds||[]).length+1,2);STATE.state=STATE.currentRound===2?STATES.ROUND_2_READY:STATES.ATHLETE_READY;STATE.publicMode="ready";STATE.publishedResult=null;resetTimer();broadcast();render();return true;
}
function previousAthlete(){return navigateAthlete(-1)}
function followingAthlete(){return navigateAthlete(1)}
function toggleKeyboardTimer(){
 if([STATES.ATHLETE_READY,STATES.ROUND_2_READY].includes(STATE.state)) return startPerformance();
 if(STATE.state===STATES.ROUND_RUNNING) return STATE.timer?.running?pausePerformance():resumePerformance();
 if(STATE.state===STATES.TIME_FINISHED)return false;
 return false;
}
function updateOperatorTimerDisplay(){
 const value=fmtTime(remainingTime());
 document.querySelectorAll(".kpi div").forEach(el=>{
   const txt=el.firstChild?.textContent?.trim();
   if(txt==="TIMER") { const b=el.querySelector("b"); if(b)b.textContent=value; }
 });
 document.querySelectorAll(".timerValue, .operatorTimer, .timerDisplay").forEach(el=>el.textContent=value);
}

// Keyboard workflow: Enter validates; Space starts/pauses; Left/Right navigates athletes.
let operatorEnterBound=false;
function bindOperatorKeyboard(){
 if(operatorEnterBound)return; operatorEnterBound=true;
 window.addEventListener("keydown",e=>{
   if(new URLSearchParams(location.search).get("display")==="public")return;
   const tag=(e.target?.tagName||"").toLowerCase();
   const typing=["input","textarea","select"].includes(tag);
   if(e.key==="Enter" && !e.ctrlKey && !e.altKey && !e.metaKey){
     if(STATE.state===STATES.CALCULATING){e.preventDefault();sendResult();return;}
     if(STATE.state===STATES.RESULT_READY){e.preventDefault();if(STATE.currentRound===2)publishFinalScore();else continueToRound2();return;}
   }
   // In the initial Setup only: ArrowRight moves from one athlete/club field to the next.
   // It must never change the active athlete during the actual competition.
   if(typing && e.key==="ArrowRight"){
     const setupRoot=document.getElementById("setupAthleteFields");
     const target=e.target;
     if(setupRoot && setupRoot.contains(target)){
       const fields=[...setupRoot.querySelectorAll("input:not([disabled]), select:not([disabled])")];
       const idx=fields.indexOf(target);
       if(idx>=0 && idx<fields.length-1){e.preventDefault();fields[idx+1].focus();fields[idx+1].select?.();}
     }
     return;
   }
   if(typing)return;
   if(e.code==="Space"){e.preventDefault();toggleKeyboardTimer();return;}
 });
}
bindOperatorKeyboard();
