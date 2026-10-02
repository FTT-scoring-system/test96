// Championship branding + first-launch setup
const FEDERATION_NAME = "FÉDÉRATION TUNISIENNE DE TAEKWONDO";
const RIGHTS_TEXT = "ALL RIGHTS RESERVED • FÉDÉRATION TUNISIENNE DE TAEKWONDO";
function federationLogoSVG(){return `<img class="fedLogo officialFedLogo" src="federation_logo_transparent.png" alt="Fédération Tunisienne de Taekwondo — logo officiel" referrerpolicy="no-referrer">`}
function landingScreen(role="operator"){
 const isPublic=role==="public";
 return `<div class="landing ${isPublic?"landingPublic":"landingOperator"}">
   <div class="landingGlow glowA"></div><div class="landingGlow glowB"></div>
   <div class="landingArt leftArt" aria-hidden="true"><svg viewBox="0 0 260 300"><circle cx="130" cy="40" r="18"/><path d="M130 63 L130 150 M130 88 L72 120 M130 88 L190 112 M130 150 L76 224 M130 150 L177 194 L236 151"/><path d="M72 120 L40 91 M190 112 L222 80"/></svg></div>
   <div class="landingArt rightArt" aria-hidden="true"><svg viewBox="0 0 260 300"><circle cx="130" cy="40" r="18"/><path d="M130 63 L130 150 M130 88 L72 120 M130 88 L190 112 M130 150 L76 224 M130 150 L177 194 L236 151"/><path d="M72 120 L40 91 M190 112 L222 80"/></svg></div>
   <div class="landingCard">
     <div class="logoRing">${federationLogoSVG()}</div>
     <div class="eyebrow">WORLD TAEKWONDO • POOMSAE</div>
     <h1>${esc((STATE.setupDraft?.competitionName)||STATE.competitionName||"POOMSAE CHAMPIONSHIP")}</h1>
     <h2>${FEDERATION_NAME}</h2>
     <div class="landingRule"></div>
     <div class="landingSubtitle">OFFICIAL POOMSAE SCORING SYSTEM</div>
     <div class="landingStatus">${isPublic?"PUBLIC DISPLAY":"OPERATOR CONSOLE"}</div>
     ${isPublic?(()=>{const d=STATE.setupDraft||{};const has=d.category||d.athleteCount||d.competitionName;return `<div class="waitingText">${has?"COMPETITION SETUP IN PROGRESS…":"WAITING FOR OPERATOR CONFIGURATION…"}</div>${has?`<div class="publicSetupLive"><div><b>${esc(d.classCode||"—")}</b> · ${esc(d.category||"—")} · ${esc(d.gender||"—")}</div><div>${d.athleteCount||0} ${d.participation==="DUO"?"DUOS":d.participation==="TEAM"?"TEAMS":"ATHLETES"} · ${d.judgeCount||3} JUDGES · TAPIS ${d.matNumber||1}</div><div>${(Number(d.athleteCount)>(d.participation==="INDIVIDUAL"?8:4))?`DEMI-FINALE: ${esc(WT_DATA.poomsae[d.poomsaeSemi1]||"—")} · ${esc(WT_DATA.poomsae[d.poomsaeSemi2]||"—")}<br>`:""}FINALE: ${esc(WT_DATA.poomsae[d.poomsaeFinal1]||"—")} · ${esc(WT_DATA.poomsae[d.poomsaeFinal2]||"—")}</div>${(d.athletes||[]).length?`<div class="liveAthleteList">${d.athletes.map((a,i)=>`<span>${i+1}. ${esc(a.name||"—")}</span>`).join("")}</div>`:""}</div>`:""}`})():`<div class="landingButtons"><button class="btn goldBtn launchBtn" onclick="openCompetitionSetup()">COMMENCER LA COMPÉTITION</button><button class="btn primary launchBtn" onclick="openPublicDisplay()">OPEN PUBLIC DISPLAY</button></div>`}
     <div class="rights">${RIGHTS_TEXT}</div>
   </div>
 </div>`
}
function broadcastSetupDraft(){
 const get=id=>document.getElementById(id);
 if(!get("setupClass"))return;
 STATE.setupDraft={competitionName:get("setupCompetition")?.value.trim()||"POOMSAE CHAMPIONSHIP",classCode:get("setupClass")?.value||"",category:get("setupCategory")?.value||"",gender:get("setupGender")?.value||"",participation:get("setupParticipation")?.value||"INDIVIDUAL",athleteCount:Number(get("setupAthletes")?.value)||0,judgeCount:Number(get("setupJudges")?.value)||3,matNumber:Number(get("setupMat")?.value)||1,poomsaeSemi1:get("setupSemiPoomsae1")?.value||"",poomsaeSemi2:get("setupSemiPoomsae2")?.value||"",poomsaeFinal1:get("setupFinalPoomsae1")?.value||"",poomsaeFinal2:get("setupFinalPoomsae2")?.value||"",athletes:[...document.querySelectorAll("#setupAthleteFields .setupAthleteItem")].map(x=>{const part=get("setupParticipation")?.value||"INDIVIDUAL";const e=buildEntryFromRow(x,part);return {name:e.name||"",club:e.club||"",members:e.members||null}})};
 saveState(); broadcast();
}
function participationMemberCount(participation){return participation==="DUO"?2:participation==="TEAM"?3:1;}
function entryGenderLabel(entry){
  if(entry?.members?.length){
    const gs=entry.members.map(m=>m.gender).filter(Boolean);
    if(STATE.participation==="DUO") return "Mixed";
    if(gs.length&&gs.every(g=>g===gs[0])) return gs[0];
  }
  return entry?.gender||STATE.gender||"—";
}
function entryDisplayName(entry){
  if(entry?.members?.length) return entry.members.map(m=>m.name).filter(Boolean).join(" / ");
  return entry?.name||"";
}
function buildEntryFromRow(row, participation){
  const memberCount=participationMemberCount(participation);
  if(participation==="INDIVIDUAL"){
    return {name:row.querySelector(".athName")?.value.trim()||"",club:row.querySelector(".athClub")?.value.trim()||"",gender:STATE.gender||""};
  }
  const members=Array.from({length:memberCount},(_,i)=>({name:row.querySelector(`.memberName${i}`)?.value.trim()||"",gender:row.querySelector(`.memberGender${i}`)?.value||""}));
  return {members,club:row.querySelector(".athClub")?.value.trim()||"",name:members.map(m=>m.name).filter(Boolean).join(" / "),gender:participation==="DUO"?"Mixed":(members[0]?.gender||"")};
}

function normalizeExcelHeader(v){return String(v??"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"");}
function importAthletesFromExcel(file){
 if(!file)return;
 if(typeof XLSX==="undefined")return alert("Le module Excel n'est pas disponible. Vérifiez la connexion Internet puis rechargez la page.");
 const reader=new FileReader();
 reader.onload=e=>{
   try{
     const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array"});
     const ws=wb.Sheets[wb.SheetNames[0]];
     const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
     if(!rows.length)throw new Error("Fichier vide");
     const first=rows[0].map(normalizeExcelHeader);
     const nameKeys=["nom","nomprenom","nometprenom","athlete","athletenom","name","fullname","participant","participantnom"];
     const clubKeys=["club","clubnom","association","team","equipe","structure"];
     let nameIdx=first.findIndex(x=>nameKeys.includes(x));
     let clubIdx=first.findIndex(x=>clubKeys.includes(x));
     let start=1;
     if(nameIdx<0){
       nameIdx=0; clubIdx=rows[0].length>1?1:-1; start=0;
     }
     const imported=[];
     for(let i=start;i<rows.length;i++){
       const r=rows[i]||[];
       const name=String(r[nameIdx]??"").trim();
       const club=clubIdx>=0?String(r[clubIdx]??"").trim():"";
       if(name)imported.push({name,club});
     }
     if(!imported.length)throw new Error("Aucun athlète trouvé. Utilisez des colonnes Nom et Club.");
     if(imported.length>50)throw new Error("Le fichier contient plus de 50 athlètes. La limite est de 50.");
     const part=document.getElementById("setupParticipation");
     if(part&&part.value!=="INDIVIDUAL"){
       part.value="INDIVIDUAL";
       part.dispatchEvent(new Event("change",{bubbles:true}));
     }
     const count=document.getElementById("setupAthletes");
     if(count){count.value=String(imported.length);count.dispatchEvent(new Event("change",{bubbles:true}));}
     const fields=document.getElementById("setupAthleteFields");
     if(!fields)throw new Error("La liste des athlètes n'est pas disponible.");
     const items=[...fields.querySelectorAll(".setupAthleteItem")];
     imported.forEach((a,i)=>{
       const row=items[i]; if(!row)return;
       const n=row.querySelector(".athName"),c=row.querySelector(".athClub");
       if(n)n.value=a.name;
       if(c)c.value=a.club;
     });
     fields.dispatchEvent(new Event("input",{bubbles:true}));
     const status=document.getElementById("excelImportStatus");
     if(status){status.textContent=`${imported.length} ATHLÈTES IMPORTÉS`;status.classList.add("successImport");}
     if(typeof validateSetupAthletes==="function")validateSetupAthletes();
     if(typeof broadcastSetupDraft==="function")broadcastSetupDraft();
   }catch(err){alert(`Import Excel impossible : ${err.message||err}`);}
   const input=document.getElementById("setupExcelFile");if(input)input.value="";
 };
 reader.onerror=()=>alert("Impossible de lire le fichier Excel.");
 reader.readAsArrayBuffer(file);
}
function handleExcelFileInput(input){importAthletesFromExcel(input?.files?.[0]);}

function openCompetitionSetup(){
 const modal=document.getElementById("setupModal"); if(modal){modal.classList.add("open");return}
 document.body.insertAdjacentHTML("beforeend",`<div id="setupModal" class="setupOverlay open"><div class="setupModal">
   <div class="setupTop"><div>${federationLogoSVG()}</div><div><div class="phaseTag">COMPETITION SETUP</div><h2>INITIALISATION DE LA CATÉGORIE</h2><p>Le système choisira automatiquement la phase.</p></div></div>
   <div class="cardMini excelImportCard">
     <div class="phaseTag">IMPORTATION DE LA LISTE DES ATHLÈTES</div>
     <div class="excelImportRow">
       <div><strong>Importer depuis Excel</strong><p class="muted">Colonnes recommandées : <b>Nom</b> et <b>Club</b>. Maximum 50 athlètes.</p></div>
       <label class="btn primary excelFileBtn">CHOISIR UN FICHIER EXCEL<input id="setupExcelFile" type="file" accept=".xlsx,.xls,.csv" onchange="handleExcelFileInput(this)"></label>
     </div>
     <div id="excelImportStatus" class="excelImportStatus">AUCUN FICHIER IMPORTÉ</div>
   </div>
   <div class="setupGrid">
     <label>Nom de la compétition<input id="setupCompetition" value="${esc(STATE.competitionName||"POOMSAE CHAMPIONSHIP")}" placeholder="Nom de la compétition"></label>
     <label>Classe<select id="setupClass"><option value="A">A</option><option value="B">B</option></select></label>
     <label>Catégorie<select id="setupCategory"></select></label>
     <label>Sexe<select id="setupGender"><option value="Male">Male</option><option value="Female">Female</option></select></label>
     <label>Participation<select id="setupParticipation"><option value="INDIVIDUAL">Indiv</option><option value="DUO">Duo</option><option value="TEAM">Team</option></select></label>
     <label>Nombre d'athlètes<select id="setupAthletes">${Array.from({length:50},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("")}</select></label>
     <label>Nombre de juges<select id="setupJudges">${WT_DATA.judges.map(n=>`<option value="${n}">${n}</option>`).join("")}</select></label>
     <label>Numéro du tapis<select id="setupMat">${WT_DATA.mats.map(n=>`<option value="${n}">Tapis ${n}</option>`).join("")}</select></label>
   </div>
   <div class="poomsaeSetup cardMini">
     <div class="phaseTag">POOMSAE OFFICIELLES — FIXATION DE LA COMPÉTITION</div>
     <p class="muted">Après le nombre d’athlètes, si un demi-final est requis, choisissez les 2 Poomsae du demi-final et les 2 Poomsae de la finale. Elles seront verrouillées avant le début de la compétition.</p>
     <div id="semiPoomsaeSetup">
       <div class="phaseTag">DEMI-FINALE — 2 POOMSAE</div>
       <div class="setupGrid twoCols">
         <label>Round 1 — Demi-finale<select id="setupSemiPoomsae1"></select></label>
         <label>Round 2 — Demi-finale<select id="setupSemiPoomsae2"></select></label>
       </div>
     </div>
     <div class="phaseTag" style="margin-top:16px">FINALE — 2 POOMSAE</div>
     <div class="setupGrid twoCols">
       <label>Round 1 — Finale<select id="setupFinalPoomsae1"></select></label>
       <label>Round 2 — Finale<select id="setupFinalPoomsae2"></select></label>
     </div>
     <div class="lockNotice">🔒 POOMSAE FIXÉES — L'opérateur ne pourra plus les modifier pendant la compétition.</div>
   </div>
   <div id="athleteSetup" class="athleteSetup cardMini">
     <div class="phaseTag">ATHLETES — FIXATION DE LA LISTE</div>
     <p class="muted">Saisissez les noms avant le début de la compétition. La liste sera verrouillée après confirmation.</p>
     <div id="setupAthleteFields" class="setupAthleteFields"></div>
   </div>
   <div id="phasePreview" class="phasePreview"></div>
   <div class="setupActions"><button class="btn" onclick="closeCompetitionSetup()">ANNULER</button><button class="btn goldBtn" onclick="confirmCompetitionSetup()">CONFIRMER & COMMENCER</button></div>
 </div></div>`);
 const cls=document.getElementById("setupClass"),cat=document.getElementById("setupCategory"),count=document.getElementById("setupAthletes"),judges=document.getElementById("setupJudges"),pSemi1=document.getElementById("setupSemiPoomsae1"),pSemi2=document.getElementById("setupSemiPoomsae2"),pFinal1=document.getElementById("setupFinalPoomsae1"),pFinal2=document.getElementById("setupFinalPoomsae2"), athleteFields=document.getElementById("setupAthleteFields");
 cls.value=STATE.classCode||"B"; cat.innerHTML=WT_DATA.categories.map(x=>`<option>${esc(x)}</option>`).join(""); cat.value=STATE.category||"Cadet"; document.getElementById("setupGender").value=STATE.gender||""; document.getElementById("setupParticipation").value=STATE.participation||"INDIVIDUAL"; count.value=STATE.athleteCount||8; judges.value=STATE.judgeCount||3; document.getElementById("setupMat").value=STATE.matNumber||1;
 const refreshPoomsae=()=>{
   const allowed=allowedPoomsae(cls.value,cat.value);
   const opts=allowed.map(k=>`<option value="${k}">${esc(WT_DATA.poomsae[k])}</option>`).join("");
   [pSemi1,pSemi2,pFinal1,pFinal2].forEach(x=>x.innerHTML=opts);
   const fixed=STATE.fixedPoomsae||{};
   const semi=fixed.semi||{}; const fin=fixed.final||{};
   pSemi1.value=allowed.includes(semi.round1)?semi.round1:(fixed.round1&&allowed.includes(fixed.round1)?fixed.round1:(allowed[0]||""));
   pSemi2.value=allowed.includes(semi.round2)?semi.round2:(fixed.round2&&allowed.includes(fixed.round2)?fixed.round2:(allowed[1]||allowed[0]||""));
   pFinal1.value=allowed.includes(fin.round1)?fin.round1:(allowed[1]||allowed[0]||"");
   pFinal2.value=allowed.includes(fin.round2)?fin.round2:(allowed[2]||allowed[1]||allowed[0]||"");
   const semiWrap=document.getElementById("semiPoomsaeSetup"); const partNow=document.getElementById("setupParticipation")?.value||"INDIVIDUAL"; const thresholdNow=partNow==="INDIVIDUAL"?8:4; if(semiWrap)semiWrap.style.display=(Number(count.value)>thresholdNow?"block":"none");
 };
 const renderAthleteFields=()=>{
   const n=Number(count.value)||1;
   const participation=document.getElementById("setupParticipation")?.value||"INDIVIDUAL";
   const memberCount=participationMemberCount(participation);
   const old=[...athleteFields.querySelectorAll(".setupAthleteItem")].map(row=>buildEntryFromRow(row, participation));
   athleteFields.innerHTML=Array.from({length:n},(_,i)=>{
     const v=old[i]||{};
     if(participation==="INDIVIDUAL") return `<div class="setupAthleteItem"><span class="athNo">${i+1}</span><input class="athName" placeholder="Nom et prénom de l'athlète ${i+1}" value="${esc(v.name||"")}"><input class="athClub" placeholder="Club ${i+1}" value="${esc(v.club||"")}"></div>`;
     const members=Array.from({length:memberCount},(_,m)=>v.members?.[m]||{});
     const memberInputs=members.map((m,mi)=>`<div class="memberCell"><input class="memberName${mi}" placeholder="${participation==="DUO"?`Athlète ${mi+1}`:`Membre ${mi+1}`} — nom et prénom" value="${esc(m.name||"")}">${participation==="DUO"?`<select class="memberGender${mi}"><option value="">Sexe</option><option value="Male" ${m.gender==="Male"?"selected":""}>Male</option><option value="Female" ${m.gender==="Female"?"selected":""}>Female</option></select>`:""}</div>`).join("");
     return `<div class="setupAthleteItem groupEntry"><span class="athNo">${i+1}</span><div class="groupMembers">${memberInputs}</div><input class="athClub" placeholder="Club / Équipe ${i+1}" value="${esc(v.club||"")}"><small class="groupHint">${participation==="DUO"?"DUO : 1 homme + 1 femme · même club":"TEAM : 3 membres · même sexe · même club"}</small></div>`;
   }).join("");
 };
 const update=()=>{const n=Number(count.value);const part=document.getElementById("setupParticipation")?.value||"INDIVIDUAL";const threshold=part==="INDIVIDUAL"?8:4;const semiWrap=document.getElementById("semiPoomsaeSetup");if(semiWrap)semiWrap.style.display=n>threshold?"block":"none";const qualifier=part==="INDIVIDUAL"?8:4;const label=part==="DUO"?"DUOS":part==="TEAM"?"ÉQUIPES":"ATHLÈTES";document.getElementById("phasePreview").innerHTML=n<=threshold?`<span class="direct">DIRECT FINAL</span><small>${n} ${label} • ACCÈS DIRECT À LA FINALE</small>`:`<span class="semi">SEMI-FINAL</span><small>${n} ${label} • TOP ${qualifier} POUR LA FINALE</small>`;renderAthleteFields()};
 cls.addEventListener("change",()=>{refreshPoomsae();broadcastSetupDraft()});
 cat.addEventListener("change",()=>{refreshPoomsae();broadcastSetupDraft()});
 const participationEl=document.getElementById("setupParticipation");
 participationEl?.addEventListener("change",()=>{update();broadcastSetupDraft()});
 count.addEventListener("change",()=>{update();broadcastSetupDraft()});
 judges.addEventListener("change",broadcastSetupDraft);
 ["setupCompetition","setupGender","setupParticipation","setupSemiPoomsae1","setupSemiPoomsae2","setupFinalPoomsae1","setupFinalPoomsae2","setupJudges","setupMat"].forEach(id=>document.getElementById(id)?.addEventListener("input",broadcastSetupDraft));
 ["setupGender","setupParticipation","setupSemiPoomsae1","setupSemiPoomsae2","setupFinalPoomsae1","setupFinalPoomsae2","setupJudges","setupMat"].forEach(id=>document.getElementById(id)?.addEventListener("change",broadcastSetupDraft));
 athleteFields.addEventListener("input",()=>{broadcastSetupDraft();validateSetupAthletes();});
 athleteFields.addEventListener("change",()=>{broadcastSetupDraft();validateSetupAthletes();});
 refreshPoomsae();update();renderJudgeNameFields();broadcastSetupDraft();validateSetupAthletes();
}
function closeCompetitionSetup(){document.getElementById("setupModal")?.remove()}
function validateSetupAthletes(showErrors=false){
 const rows=[...document.querySelectorAll("#setupAthleteFields .setupAthleteItem")];
 const participation=document.getElementById("setupParticipation")?.value||STATE.participation||"INDIVIDUAL";
 let ok=true; const names=[];
 rows.forEach(row=>{
   if(participation==="INDIVIDUAL"){
     const nameEl=row.querySelector(".athName"),clubEl=row.querySelector(".athClub");
     const name=nameEl?.value.trim()||"",club=clubEl?.value.trim()||"";
     nameEl?.classList.toggle("invalid-athlete",!name);clubEl?.classList.toggle("invalid-athlete",!club);if(!name||!club)ok=false;names.push(name.toLowerCase());return;
   }
   const clubEl=row.querySelector(".athClub");const club=clubEl?.value.trim()||"";clubEl?.classList.toggle("invalid-athlete",!club);if(!club)ok=false;
   const members=[...row.querySelectorAll(".groupMembers .memberCell")].map(cell=>({name:cell.querySelector("input")?.value.trim()||"",gender:cell.querySelector("select")?.value||"",nameEl:cell.querySelector("input"),genderEl:cell.querySelector("select")}));
   members.forEach(m=>{m.nameEl?.classList.toggle("invalid-athlete",!m.name);if(participation==="DUO")m.genderEl?.classList.toggle("invalid-athlete",!m.gender);if(!m.name||(participation==="DUO"&&!m.gender))ok=false;names.push(m.name.toLowerCase())});
   if(participation==="DUO" && members.length===2 && members[0].gender===members[1].gender){members.forEach(m=>m.genderEl?.classList.add("invalid-athlete"));ok=false;}
   if(participation==="TEAM" && !document.getElementById("setupGender")?.value){ok=false;}
 });
 const seen=new Map();names.filter(Boolean).forEach(n=>seen.set(n,(seen.get(n)||0)+1));
 rows.forEach(row=>row.querySelectorAll(".athName,.groupMembers input").forEach(el=>{const n=el.value.trim().toLowerCase();if(n&&seen.get(n)>1){el.classList.add("invalid-athlete");ok=false;}}));
 const btn=document.querySelector(".setupActions .goldBtn");if(btn){btn.disabled=!ok;btn.title=ok?"":(participation==="DUO"?"Chaque duo doit avoir 2 athlètes du même club : 1 homme + 1 femme.":participation==="TEAM"?"Chaque équipe doit avoir 3 athlètes du même club et du même sexe.":"Complétez les noms et clubs des athlètes.");}
 return ok;
}
function confirmCompetitionSetup(){
 const name=document.getElementById("setupCompetition")?.value.trim()||"POOMSAE CHAMPIONSHIP";
 const count=Number(document.getElementById("setupAthletes")?.value)||1;
 const previousMat=Number(STATE.matNumber)||1; STATE.competitionName=name;STATE.participation=document.getElementById("setupParticipation").value||"INDIVIDUAL";STATE.matNumber=Number(document.getElementById("setupMat").value)||1; if(typeof ensureStationId==="function" && (!STATE.stationId || previousMat!==STATE.matNumber)){STATE.stationId=stationNewId(STATE.matNumber);}STATE.classCode=document.getElementById("setupClass").value;STATE.category=document.getElementById("setupCategory").value;STATE.gender=document.getElementById("setupGender").value;STATE.athleteCount=count;STATE.judgeCount=Number(document.getElementById("setupJudges").value)||3;STATE.matNumber=Number(document.getElementById("setupMat").value)||1;STATE.judgeNames=STATE.judgeNames||{};for(let j=1;j<=STATE.judgeCount;j++){if(typeof STATE.judgeNames[j]!=="string")STATE.judgeNames[j]="";}const phaseThreshold=STATE.participation==="INDIVIDUAL"?8:4;STATE.phase=count<=phaseThreshold?"DIRECT FINAL":"SEMI-FINAL";
 STATE.fixedPoomsae={semi:{round1:document.getElementById("setupSemiPoomsae1").value,round2:document.getElementById("setupSemiPoomsae2").value},final:{round1:document.getElementById("setupFinalPoomsae1").value,round2:document.getElementById("setupFinalPoomsae2").value}};
 STATE.fixedPoomsae.round1=STATE.fixedPoomsae.final.round1; STATE.fixedPoomsae.round2=STATE.fixedPoomsae.final.round2;
 const semiThreshold=STATE.participation==="INDIVIDUAL"?8:4; if(count>semiThreshold && (!STATE.fixedPoomsae.semi.round1||!STATE.fixedPoomsae.semi.round2))return alert("Sélectionnez les 2 Poomsae du demi-final.");
 if(!STATE.fixedPoomsae.final.round1||!STATE.fixedPoomsae.final.round2)return alert("Sélectionnez les 2 Poomsae de la finale.");
 const rows=[...document.querySelectorAll("#setupAthleteFields .setupAthleteItem")];
 if(rows.length!==count)return alert("Le nombre d'athlètes ne correspond pas à la liste.");
 const names=rows.map(x=>x.querySelector(".athName")?.value.trim()||"");
 const clubs=rows.map(x=>x.querySelector(".athClub")?.value.trim()||"");
 if(!validateSetupAthletes(true))return false;
 // Keep existing QR tokens/Peer connection across category changes. Only create tokens for newly added judges.
 STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
 STATE.collectorQr=STATE.collectorQr||{peerId:"",token:"",deleted:false};
 if(typeof judgeConnections!=="undefined"){
   Object.keys(judgeConnections).forEach(k=>{if(Number(k)>STATE.judgeCount){try{judgeConnections[k]?.close()}catch(_){} delete judgeConnections[k];}});
 }
 for(let j=1;j<=STATE.judgeCount;j++){if(!STATE.judgeQr.tokens[j])STATE.judgeQr.tokens[j]=judgeRandomToken();STATE.judgeQr.deleted[j]=false;}
 Object.keys(STATE.judgeQr.tokens).forEach(k=>{if(Number(k)>STATE.judgeCount)delete STATE.judgeQr.tokens[k];});
 STATE.judgeQr.sessionId="";STATE.judgeQr.scores={};
 if(typeof judgePeer!=="undefined" && judgePeer?.open){STATE.judgeQr.peerId=judgePeer.id;STATE.collectorQr.peerId=judgePeer.id;}
 saveState();
 STATE.setupComplete=true;STATE.competitionStarted=false;const builtEntries=rows.map(row=>buildEntryFromRow(row,STATE.participation));if(STATE.participation==="DUO")STATE.gender="Mixed";if(STATE.participation==="TEAM")builtEntries.forEach(entry=>{entry.gender=STATE.gender;entry.members?.forEach(m=>{m.gender=STATE.gender;});}); STATE.athletes=builtEntries.map((entry)=>({id:crypto.randomUUID?.()||String(Date.now()+Math.random()),name:entry.name,club:entry.club||"—",gender:entry.gender||STATE.gender,participation:STATE.participation,members:entry.members||null,matNumber:STATE.matNumber,absent:false,rounds:[],finalScore:null}));STATE.currentIndex=0;STATE.currentRound=1;STATE.rankings=[];STATE.publishedResult=null;STATE.tieResolutions={};STATE.state=STATES.IDLE;STATE.publicMode="ready";STATE.timer={elapsed:0,running:false,expired:false};saveState();closeCompetitionSetup();broadcast();render();
 if(typeof ensureJudgePeer==="function"){ensureJudgePeer(()=>{try{judgeSendContext({scoringOpen:false});}catch(_){} });}
}
