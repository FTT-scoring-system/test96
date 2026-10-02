/* FTT Poomsae — Remote Judge QR / Phone Interface */
let judgePeer = null;
let judgeConnections = {};
let judgeRuntime = { currentSession: "", connected: 0 };
let ctxMatForHeader = Number(new URLSearchParams(location.search).get("mat")) || 1;

function judgeRandomToken(){
  if(window.crypto?.getRandomValues){const a=new Uint32Array(3);crypto.getRandomValues(a);return [...a].map(x=>x.toString(36)).join("");}
  return Math.random().toString(36).slice(2)+Date.now().toString(36);
}
function judgeNewSessionId(){return "S"+Date.now().toString(36)+judgeRandomToken().slice(0,6);}
function stationNewId(mat){return "T"+Number(mat||1)+"-"+judgeRandomToken().slice(0,8);}
function ensureStationId(){if(!STATE.stationId)STATE.stationId=stationNewId(STATE.matNumber||1);return STATE.stationId;}
function judgeIsPhone(){return new URLSearchParams(location.search).get("judge")==="1";}
function judgeParams(){const q=new URLSearchParams(location.search);return {peer:q.get("peer")||"",judge:Number(q.get("j")||0),token:q.get("t")||"",mat:Number(q.get("mat")||0)||1,station:q.get("station")||""};}
function judgeBaseUrl(){return location.origin+location.pathname;}

function ensureJudgePeer(){
  if(typeof Peer!=="function")return;
  if(judgePeer && !judgePeer.destroyed)return;
  ensureStationId();
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  // Reserve the Peer ID before QR generation so scanned QR links are never built with an empty peer.
  const desired=(STATE.judgeQr.peerId)||("ftt-poomsae-"+judgeRandomToken().slice(0,12));
  STATE.judgeQr.peerId=desired;
  saveState();
  judgePeer=new Peer(desired,{debug:0});
  judgePeer.on("open",id=>{
    STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
    STATE.judgeQr.peerId=id;
    STATE.collectorQr=STATE.collectorQr||{peerId:"",token:"",deleted:false}; STATE.collectorQr.peerId=id;
    saveState();
    judgeSendContext();
    if(document.getElementById("judgesQrOverlay")){ setTimeout(()=>{ judgeRenderAllQRCodes(); judgeUpdateQrStatuses(); },60); }
    if(document.getElementById("collectorQrOverlay")){ ensureCollectorQr(); renderCollectorQRCode(); }
  });
  judgePeer.on("connection",conn=>{
    conn.on("open",()=>{
      const data=conn.metadata||{};
      const role=String(data.role||"judge");
      const station=String(data.station||"");
      if(station!==String(STATE.stationId||ensureStationId())){try{conn.close()}catch(_){} return;}
      if(role==="collector") {
        const token=String(data.token||"");
        if(!token || token!==String(STATE.collectorQr?.token||"")){conn.close();return;}
        window.collectorConnection=conn;
        conn.on("close",()=>{if(window.collectorConnection===conn)window.collectorConnection=null;});
        conn.on("data",msg=>{
          if(msg?.type==="COLLECTOR_HELLO"){
            const helloToken=String(msg.token||"");
            if(helloToken===String(STATE.collectorQr?.token||"")){
              try{conn.send({...judgeContextPayload(),type:"COLLECTOR_CONTEXT"});}catch(_){}
            }
            return;
          }
          collectorReceive(msg);
        });
        try{conn.send({...judgeContextPayload(),type:"COLLECTOR_CONTEXT"});}catch(_){}
        judgeUpdateQrStatuses();
        return;
      }
      const j=Number(data.judge||0), token=String(data.token||"");
      if(!j || STATE.judgeQr?.tokens?.[j]!==token){conn.close();return;}
      judgeConnections[j]=conn;
      conn.on("data",msg=>{
        if(msg?.type==="JUDGE_HELLO"){
          try{conn.send({type:"CONTEXT",...judgeContextPayload()});}catch(_){}
          return;
        }
        judgeReceive(msg,j);
      });
      conn.on("close",()=>{delete judgeConnections[j];judgeUpdateQrStatuses();});
      // Always send the current state immediately, including SCORING OPEN when a round is already running.
      try{conn.send({type:"CONTEXT",...judgeContextPayload()});}catch(_){}
      judgeUpdateQrStatuses();
    });
    conn.on("error",()=>{});
  });
  judgePeer.on("error",e=>{console.warn("Judge peer",e); if(e?.type==="unavailable-id"){ try{judgePeer.destroy()}catch(_){} STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}}; STATE.judgeQr.peerId=""; setTimeout(ensureJudgePeer,250); }});
}
function judgeReceive(msg,j){
  if(!msg||msg.type!=="SCORE")return;
  if(String(msg.token)!==String(STATE.judgeQr?.tokens?.[j]||""))return;
  if(msg.sessionId!==STATE.judgeQr?.sessionId)return;
  const a=msg.accuracy, p=msg.presentation;
  if(!Number.isFinite(Number(a))||Number(a)<0||Number(a)>4)return;
  const parts=msg.parts||{};
  const vals=[parts.speedPower,parts.rhythmTempo,parts.expressionEnergy].map(Number);
  if(vals.some(v=>!Number.isFinite(v)||v<0.5||v>2))return;
  const presentation=Number((vals[0]+vals[1]+vals[2]).toFixed(1));
  if(Math.abs(presentation-Number(p))>0.001)return;
  STATE.judgeQr.scores[j]={accuracy:Number(a),presentation,parts:{speedPower:vals[0],rhythmTempo:vals[1],expressionEnergy:vals[2]},receivedAt:Date.now(),sessionId:msg.sessionId};
  saveState();
  if(window.collectorConnection?.open){try{window.collectorConnection.send({type:"COLLECTOR_CONTEXT",...judgeContextPayload({scoreReceived:true,judge:j})});}catch(_){} }
  const ai=j-1;
  const acc=document.getElementById(`acc${ai}`),pres=document.getElementById(`pres${ai}`);
  if(acc)acc.value=Number(a).toFixed(1);
  if(pres)pres.value=presentation.toFixed(1);
  updateJudgeSubmitButton?.();
  judgeUpdateQrStatuses();
  renderJudgeRemoteToast?.(j);
}
function judgeContextPayload(extra={}){
  const a=currentAthlete?.();
  const p=currentRoundPoomsae?.();
  return {type:"CONTEXT",stationId:ensureStationId(),sessionId:STATE.judgeQr?.sessionId||"",active:[STATES.ROUND_RUNNING,STATES.CALCULATING,STATES.TIE_BREAK_RUNNING,STATES.TIE_BREAK_CALCULATING].includes(STATE.state),scoringOpen:[STATES.ROUND_RUNNING,STATES.CALCULATING,STATES.TIE_BREAK_RUNNING,STATES.TIE_BREAK_CALCULATING].includes(STATE.state),round:STATE.currentRound,athlete:a?.name||"",club:a?.club||"",poomsae:WT_DATA.poomsae[p]||p||"",competition:STATE.competitionName||"FTT POOMSAE",matNumber:STATE.matNumber||1,judgeScores:STATE.judgeQr?.scores||{},judgeCount:Number(STATE.judgeCount||0),judgeNames:STATE.judgeNames||{},tieBreak:!!STATE.tieBreak?.active,tieBreakStage:STATE.tieBreak?.stage||"",...extra};
}
function judgeSendContext(extra={}){
  const payload=judgeContextPayload(extra);
  Object.values(judgeConnections||{}).forEach(c=>{try{if(c.open)c.send(payload)}catch(e){}});
  const collector=window.collectorConnection;
  if(collector?.open){
    try{ collector.send({...payload,type:"COLLECTOR_CONTEXT"}); }catch(e){}
  }
}
function judgeGenerateTokens(){
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  STATE.judgeQr.tokens={};STATE.judgeQr.deleted={};STATE.judgeQr.scores={};
  for(let i=1;i<=Number(STATE.judgeCount||0);i++)STATE.judgeQr.tokens[i]=judgeRandomToken();
  saveState();ensureJudgePeer();openJudgesQR(true);
}
function judgeRegenerateOne(j){
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  STATE.judgeQr.tokens[j]=judgeRandomToken();
  STATE.judgeQr.deleted[j]=false;
  delete STATE.judgeQr.scores[j];
  try{judgeConnections[j]?.close()}catch(e){}
  delete judgeConnections[j];saveState();openJudgesQR(true);
}
function judgeDeleteOne(j){
  if(!confirmAction(`DELETE QR FOR JUDGE ${j}?`))return;
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  delete STATE.judgeQr.tokens[j];STATE.judgeQr.deleted[j]=true;delete STATE.judgeQr.scores[j];
  try{judgeConnections[j]?.close()}catch(e){} delete judgeConnections[j];
  saveState();openJudgesQR(true);
}
function judgeUpdateQrStatuses(){
  Object.keys(STATE.judgeQr?.tokens||{}).forEach(j=>{const connected=!!judgeConnections[j]?.open, scored=!!STATE.judgeQr?.scores?.[j];const el=document.getElementById(`judgeQrStatus${j}`);if(el){el.textContent=scored?"SCORE RECEIVED":connected?"CONNECTED":"WAITING";el.classList.toggle("connected",connected||scored);}const op=document.querySelector(`.operatorJudgeStatusItem[data-judge="${j}"]`);if(op){op.classList.toggle("online",connected);op.classList.toggle("scored",scored);const st=op.querySelector("span");if(st)st.textContent=scored?"SCORE RECEIVED":connected?"CONNECTED":"WAITING";}});
  const cs=document.getElementById("collectorQrStatus");if(cs)cs.textContent=window.collectorConnection?.open?"CONNECTED":"WAITING";
}
function judgeQrUrl(j){
  const base=judgeBaseUrl();
  const peer=STATE.judgeQr?.peerId||"";
  return `${base}?judge=1&peer=${encodeURIComponent(peer)}&j=${j}&t=${encodeURIComponent(STATE.judgeQr.tokens[j]||"")}&mat=${encodeURIComponent(Number(STATE.matNumber)||1)}&station=${encodeURIComponent(ensureStationId())}`;
}
function openJudgesQR(regenerate=false){
  if(location.protocol==="file:")return alert("JUDGES QR requires the project to be opened from GitHub Pages, Netlify, or a local web server (not directly as a file).");
  if(!STATE.setupComplete)return alert("Complete the Competition Setup first.");
  ensureJudgePeer();
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  if(!Object.keys(STATE.judgeQr.tokens||{}).length || Object.keys(STATE.judgeQr.tokens||{}).length!==Number(STATE.judgeCount||0)){
    STATE.judgeQr.tokens={};STATE.judgeQr.deleted={};STATE.judgeQr.scores={};for(let i=1;i<=STATE.judgeCount;i++)STATE.judgeQr.tokens[i]=judgeRandomToken();saveState();
  }
  const old=document.getElementById("judgesQrOverlay");if(old)old.remove();
  const overlay=document.createElement("div");overlay.id="judgesQrOverlay";overlay.className="judgeQrOverlay";
  overlay.innerHTML=`<div class="judgeQrModal"><div class="judgeQrHeader"><div><div class="phaseTag">REMOTE JUDGES</div><h2>JUDGES QR</h2><p>Chaque juge scanne uniquement son QR code avec son téléphone.</p></div><button class="btn" onclick="document.getElementById('judgesQrOverlay')?.remove()">CLOSE</button></div><div class="judgeQrGrid">${Array.from({length:Number(STATE.judgeCount||0)},(_,idx)=>{const j=idx+1;const hasQr=!!STATE.judgeQr.tokens?.[j];return `<div class="judgeQrCard"><div class="judgeQrCardTop"><div><strong>JUDGE ${j}</strong><small class="judgeQrName" data-judge-name="${j}">${esc(STATE.judgeNames?.[j]||"NAME NOT SET")}</small></div><span id="judgeQrStatus${j}" class="judgeQrStatus">${hasQr?(judgeConnections[j]?.open?"CONNECTED":"WAITING"):"QR DELETED"}</span></div>${hasQr?`<div id="judgeQr${j}" class="judgeQrImage"></div><div class="judgeQrHint">SCAN WITH PHONE</div>`:`<div class="judgeQrImage judgeQrDeleted"><span>QR<br>DELETED</span></div><div class="judgeQrHint">GENERATE A NEW CODE</div>`}<label class="judgeQrNameEditor">NOM DU JUGE ${j}<input type="text" value="${esc(STATE.judgeNames?.[j]||"")}" placeholder="Nom et prénom du juge ${j}" oninput="judgeSetName(${j},this.value)"></label><div class="judgeQrActions"><button class="btn" onclick="judgeRegenerateOne(${j})">${hasQr?"CHANGE QR":"GENERATE QR"}</button><button class="btn danger" onclick="judgeDeleteOne(${j})" ${hasQr?"":"disabled"}>DELETE</button></div></div>`}).join("")}</div><div class="judgeQrFooter"><span>PEER CONNECTION: <b>${esc(STATE.judgeQr.peerId||"CONNECTING...")}</b></span><button class="btn primary" onclick="judgeGenerateTokens()">REGENERATE ALL QR</button></div></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(()=>judgeRenderAllQRCodes());
  setTimeout(()=>{ judgeRenderAllQRCodes(); judgeUpdateQrStatuses(); },250);
}

function judgeRenderAllQRCodes(){
  for(let j=1;j<=Number(STATE.judgeCount||0);j++){
    const box=document.getElementById(`judgeQr${j}`);
    if(!box || !STATE.judgeQr.tokens?.[j]) continue;
    const text=judgeQrUrl(j);
    box.innerHTML="";
    try{
      if(typeof window.QRCode === "function"){
        new QRCode(box,{text,width:190,height:190,colorDark:"#07111d",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
        if(box.children.length)continue;
      }
    }catch(e){ console.warn("QRCode library failed",e); }
    // Reliable fallback: render the QR through a public QR image endpoint.
    const img=document.createElement("img");
    img.alt=`QR CODE JUGE ${j}`;
    img.width=190; img.height=190;
    img.referrerPolicy="no-referrer";
    img.src=`https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=8&data=${encodeURIComponent(text)}`;
    img.onerror=()=>{box.innerHTML='<div style="font-size:12px;text-align:center;color:#667789;padding:25px">QR IMAGE UNAVAILABLE<br><small>Check internet connection</small></div>';};
    box.appendChild(img);
  }
}

function judgePhoneSend(type,data){
  if(window._judgePhoneScoringOpen!==true){judgePhoneToast("SCORING NOT OPEN",true);return;}
  const {peer,judge,token}=judgeParams();
  if(!peer||!judge||!token){judgePhoneToast("INVALID JUDGE LINK",true);return;}
  if(!window._judgePhoneConn||!window._judgePhoneConn.open){judgePhoneToast("NOT CONNECTED TO OPERATOR",true);return;}
  if(type!=="SCORE"){return;}
  const accuracy=Number(window._judgePhoneAcc);
  const parts={...(window._judgePhoneParts||{})};
  const vals=[parts.speedPower,parts.rhythmTempo,parts.expressionEnergy].map(Number);
  const presentation=Number(vals.reduce((a,v)=>a+v,0).toFixed(1));
  if(!Number.isFinite(accuracy)||accuracy<0||accuracy>4){judgePhoneToast("ACCURACY MUST BE 0.0–4.0",true);return;}
  if(vals.some(v=>!Number.isFinite(v)||v<0.5||v>2)||presentation<1.5||presentation>6){judgePhoneToast("PRESENTATION MUST BE 1.5–6.0",true);return;}
  const payload={type:"SCORE",accuracy:Number(accuracy.toFixed(1)),presentation,parts,judge,token,stationId:window._judgePhoneStation||"",sessionId:window._judgePhoneSession||""};
  try{window._judgePhoneConn.send(payload);window._judgePhoneSent=true;judgePhoneRenderSent();document.querySelectorAll("#judgePhoneMain button").forEach(b=>{if(b.id!=="judgePhoneSend")b.disabled=true;});const sendBtn=document.getElementById("judgePhoneSend");if(sendBtn)sendBtn.disabled=true;}catch(e){judgePhoneToast("SEND FAILED",true);}
}
function judgePhoneToast(msg,error=false){const el=document.getElementById("judgePhoneToast");if(!el)return;el.textContent=msg;el.className=`judgePhoneToast show ${error?"error":""}`;clearTimeout(window._judgeToastTimer);window._judgeToastTimer=setTimeout(()=>el.classList.remove("show"),1800);}
function judgePhoneRenderSent(){const b=document.getElementById("judgePhoneSend");if(b){b.textContent="✓ SCORE SENT";b.classList.add("sent");}}
function judgePhoneClamp(){
  const base=Number(window._judgePhoneAcc);
  const delta=Number(window._judgePhoneDelta||0);
  const next=Math.max(0,Math.min(4,Math.round((base+delta)*10)/10));
  window._judgePhoneAcc=next; window._judgePhoneDelta=0;
  const el=document.getElementById("judgeAccuracyValue");
  if(el)el.textContent=next.toFixed(1);
}
function judgePhoneAdjust(delta){
  if(window._judgePhoneSent){judgePhoneToast("SCORE ALREADY SENT",true);return;}
  if(window._judgePhoneScoringOpen!==true){judgePhoneToast("SCORING NOT OPEN",true);return;}
  const d=Number(delta); if(!Number.isFinite(d))return;
  window._judgePhoneAcc=Number(window._judgePhoneAcc||4);
  window._judgePhoneDelta=d; judgePhoneClamp();
  window._judgePhoneSent=false; judgePhoneRenderReset();
}
function judgePhoneSetPart(key,value){
  if(window._judgePhoneSent){judgePhoneToast("SCORE ALREADY SENT",true);return;}
  if(window._judgePhoneScoringOpen!==true){judgePhoneToast("SCORING NOT OPEN",true);return;}
  if(!window._judgePhoneParts)window._judgePhoneParts={speedPower:2,rhythmTempo:2,expressionEnergy:2};
  const next=Math.max(0.5,Math.min(2,Math.round(Number(value)*10)/10));
  if(!Number.isFinite(next))return;
  window._judgePhoneParts[key]=next;
  const control=document.querySelector(`[data-part-control="${key}"]`);
  if(control)control.innerHTML=judgePhoneBuildValues(key);
  const total=Object.values(window._judgePhoneParts).reduce((s,v)=>s+Number(v||0),0);
  const t=document.getElementById("judgePresentationTotal"); if(t)t.textContent=total.toFixed(1);
  window._judgePhoneSent=false; judgePhoneRenderReset();
}
function judgePhoneAdjustPart(key,delta){
  if(window._judgePhoneSent){judgePhoneToast("SCORE ALREADY SENT",true);return;}
  if(window._judgePhoneScoringOpen!==true){judgePhoneToast("SCORING NOT OPEN",true);return;}
  if(!window._judgePhoneParts)window._judgePhoneParts={speedPower:2,rhythmTempo:2,expressionEnergy:2};
  const current=Number(window._judgePhoneParts[key]||2);
  judgePhoneSetPart(key,current+Number(delta||0));
}
function judgePhoneBuildValues(key){
  const value=Number(window._judgePhoneParts[key]||2);
  return `<button type="button" class="partAdjust partMinus" ${window._judgePhoneScoringOpen!==true||value<=0.5?"disabled":""} onclick="window.judgePhoneAdjustPart('${key}',-0.1)">−</button><div class="partValue" data-part-value="${key}">${value.toFixed(1)}</div><button type="button" class="partAdjust partPlus" ${window._judgePhoneScoringOpen!==true||value>=2?"disabled":""} onclick="window.judgePhoneAdjustPart('${key}',0.1)">+</button>`;
}
window.judgePhoneAdjust=judgePhoneAdjust;
window.judgePhoneAdjustPart=judgePhoneAdjustPart;
window.judgePhoneSendScore=()=>judgePhoneSend("SCORE",{});
function renderJudgeRemoteToast(j){ const box=document.getElementById("judgeQrStatus"+j); if(box){box.textContent="SCORE RECEIVED";box.classList.add("connected");setTimeout(()=>judgeUpdateQrStatuses(),1300);} }
function judgePhoneRenderReset(){const b=document.getElementById("judgePhoneSend");if(b){b.textContent="SEND SCORE";b.classList.remove("sent");}}
async function judgePhoneFullscreen(){
  try{
    if(!document.fullscreenElement){
      await document.documentElement.requestFullscreen?.();
      try{await screen.orientation?.lock?.("landscape");}catch(_){}
    }else{
      await document.exitFullscreen?.();
    }
    judgePhoneUpdateViewport();
  }catch(e){judgePhoneToast("FULL SCREEN NOT AVAILABLE",true);}
}
function judgePhoneUpdateViewport(){
  const app=document.querySelector(".judgePhoneApp");
  const portrait=window.innerHeight>window.innerWidth;
  document.body.classList.toggle("judgePortrait",portrait);
  if(app) app.classList.toggle("judgeLandscape",!portrait);
  const b=document.getElementById("judgeFsBtn");
  if(b)b.textContent=document.fullscreenElement?"↙":"⛶";
  if(b)b.title=document.fullscreenElement?"Quitter le plein écran":"Plein écran";
}
function judgePhoneOrientationPrompt(){
  const p=document.getElementById("judgeOrientationOverlay");
  if(p)p.classList.remove("show");
}
function judgePhoneInitControls(){
  document.addEventListener("fullscreenchange",()=>{judgePhoneUpdateViewport();judgePhoneOrientationPrompt();});
  window.addEventListener("resize",()=>{judgePhoneUpdateViewport();judgePhoneOrientationPrompt();});
  judgePhoneUpdateViewport();judgePhoneOrientationPrompt();
}

function collectorRandomToken(){return judgeRandomToken();}
function collectorQrUrl(){const base=judgeBaseUrl();ensureStationId(); const peer=STATE.collectorQr?.peerId||STATE.judgeQr?.peerId||"";return `${base}?collector=1&peer=${encodeURIComponent(peer)}&t=${encodeURIComponent(STATE.collectorQr?.token||"")}&mat=${encodeURIComponent(Number(STATE.matNumber)||1)}&station=${encodeURIComponent(ensureStationId())}`;}
function ensureCollectorQr(){STATE.collectorQr=STATE.collectorQr||{peerId:"",token:"",deleted:false};if(!STATE.collectorQr.token)STATE.collectorQr.token=collectorRandomToken();STATE.collectorQr.peerId=STATE.judgeQr?.peerId||STATE.collectorQr.peerId||"";saveState();}
function openCollectorQR(){
  if(location.protocol==="file:")return alert("COLLECTOR QR requires a web server.");
  ensureJudgePeer();
  ensureCollectorQr();
  const old=document.getElementById("collectorQrOverlay");if(old)old.remove();
  const overlay=document.createElement("div");overlay.id="collectorQrOverlay";overlay.className="judgeQrOverlay";
  overlay.innerHTML=`<div class="judgeQrModal collectorModal"><div class="judgeQrHeader"><div><div class="phaseTag">REMOTE COLLECTOR</div><h2>COLLECTOR QR</h2><p>Scannez ce QR avec le téléphone du collecteur.</p></div><button class="btn" onclick="document.getElementById('collectorQrOverlay')?.remove()">CLOSE</button></div><div class="collectorQrCenter"><div id="collectorQrImage" class="judgeQrImage"></div><div class="judgeQrHint">SCAN WITH COLLECTOR PHONE</div><span id="collectorQrStatus" class="judgeQrStatus">${window.collectorConnection?.open?"CONNECTED":"WAITING"}</span><div class="judgeQrActions"><button class="btn" onclick="regenerateCollectorQR()">CHANGE QR</button><button class="btn danger" onclick="deleteCollectorQR()">DELETE</button></div></div></div>`;
  document.body.appendChild(overlay);renderCollectorQRCode();
}
function renderCollectorQRCode(){const box=document.getElementById("collectorQrImage");if(!box)return;box.innerHTML="";try{if(typeof QRCode==="function"){new QRCode(box,{text:collectorQrUrl(),width:220,height:220,colorDark:"#07111d",colorLight:"#fff",correctLevel:QRCode.CorrectLevel.M});if(box.children.length)return;}}catch(e){}const img=document.createElement("img");img.width=220;img.height=220;img.alt="COLLECTOR QR";img.src=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(collectorQrUrl())}`;box.appendChild(img);}
function regenerateCollectorQR(){ensureCollectorQr();STATE.collectorQr.token=collectorRandomToken();STATE.collectorQr.deleted=false;try{window.collectorConnection?.close()}catch(_){}window.collectorConnection=null;saveState();openCollectorQR();}
function deleteCollectorQR(){if(!confirmAction("DELETE COLLECTOR QR?"))return;STATE.collectorQr.token="";STATE.collectorQr.deleted=true;try{window.collectorConnection?.close()}catch(_){}window.collectorConnection=null;saveState();openCollectorQR();}
function collectorReceive(msg){
  if(!msg||msg.type!=="COLLECTOR_SCORES")return;
  if(STATE.state!==STATES.CALCULATING && STATE.state!==STATES.TIE_BREAK_CALCULATING)return;
  const count=Number(STATE.judgeCount||0), incoming=msg.scores||{}, scores={};
  for(let i=1;i<=count;i++){
    const v=incoming[i]; if(!v)return;
    const a=Number(v.accuracy), p=Number(v.presentation);
    if(!Number.isFinite(a)||a<0||a>4||!Number.isFinite(p)||p<1.5||p>6)return;
    scores[i]={accuracy:Number(a.toFixed(1)),presentation:Number(p.toFixed(1)),receivedAt:Date.now(),sessionId:STATE.judgeQr?.sessionId||"",source:"collector"};
  }
  STATE.judgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  STATE.judgeQr.scores=scores; saveState();
  for(let i=1;i<=count;i++){
    const acc=document.getElementById(`acc${i-1}`), pres=document.getElementById(`pres${i-1}`);
    if(acc)acc.value=scores[i].accuracy.toFixed(1);
    if(pres)pres.value=scores[i].presentation.toFixed(1);
  }
  updateJudgeSubmitButton?.(); judgeUpdateQrStatuses();
}

function collectorPhoneConnect(p){
  if(typeof Peer!=="function"){collectorPhoneToast("PeerJS unavailable",true);return;}
  if(!p.peer||!p.token){collectorPhoneToast("Invalid collector QR",true);return;}
  try{window._collectorRetryTimer&&clearInterval(window._collectorRetryTimer);}catch(_){}
  try{window._collectorPeer?.destroy?.();}catch(_){}
  const local=new Peer();
  const status=t=>{const e=document.getElementById("collectorConnection");if(e){e.textContent=t;e.classList.toggle("connected",t==="CONNECTED");}};
  let retryTimer=null;
  const connectNow=()=>{
    if(window._collectorConn?.open)return;
    let c;
    try{c=local.connect(p.peer,{reliable:true,metadata:{role:"collector",token:p.token,station:p.station||""}});}catch(e){status("RETRYING");return;}
    window._collectorConn=c;
    c.on("open",()=>{status("CONNECTED");try{c.send({type:"COLLECTOR_HELLO",token:p.token});}catch(_){} setTimeout(()=>{try{if(c.open)c.send({type:"COLLECTOR_HELLO",token:p.token});}catch(_){}},700); });
    c.on("data",m=>{if(m?.type==="COLLECTOR_CONTEXT"){window._collectorStation=String(m.stationId||p.station||"");renderCollectorPhoneContext(m);}});
    c.on("close",()=>{if(window._collectorConn===c)window._collectorConn=null;status("RETRYING");});
    c.on("error",()=>{status("RETRYING");});
  };
  local.on("open",()=>{status("CONNECTING");connectNow();retryTimer=setInterval(connectNow,1800);window._collectorRetryTimer=retryTimer;});
  local.on("error",()=>status("RETRYING"));
  window._collectorPeer=local;
}

function collectorPhoneToast(msg,error=false){const e=document.getElementById("collectorToast");if(e){e.textContent=msg;e.className=`judgePhoneToast show ${error?"error":""}`;setTimeout(()=>e.classList.remove("show"),1800);}}
function collectorValidateInput(el,min,max){
  if(!el)return false;
  const raw=String(el.value||"").trim().replace(",",".");
  el.classList.remove("scoreValid","scoreInvalid");
  if(raw==="")return false;
  const n=Number(raw);
  const ok=Number.isFinite(n)&&n>=min&&n<=max;
  el.classList.add(ok?"scoreValid":"scoreInvalid");
  return ok;
}
function collectorBindValidation(){
  document.querySelectorAll(".collectorInput").forEach(el=>{
    const isAcc=el.id.startsWith("collectorAcc");
    el.addEventListener("input",()=>collectorValidateInput(el,isAcc?0:1.5,isAcc?4:6));
    el.addEventListener("change",()=>collectorValidateInput(el,isAcc?0:1.5,isAcc?4:6));
    if(el.value)collectorValidateInput(el,isAcc?0:1.5,isAcc?4:6);
  });
}

function collectorSendScores(){
  if(!window._collectorScoringOpen){collectorPhoneToast("WAIT FOR OPERATOR TO FINISH PERFORMANCE",true);return;}
  const count=Number(window._collectorJudgeCount||0), scores={};
  for(let i=1;i<=count;i++){
    const a=document.getElementById(`collectorAcc${i}`), p=document.getElementById(`collectorPres${i}`);
    const acc=Number(String(a?.value||"").replace(",",".")), pres=Number(String(p?.value||"").replace(",","."));
    const accOk=collectorValidateInput(a,0,4); const presOk=collectorValidateInput(p,1.5,6); if(!accOk||!presOk){collectorPhoneToast(`ENTER VALID SCORES FOR JUDGE ${i}`,true);(accOk?p:a)?.focus();return;}
    scores[i]={accuracy:Number(acc.toFixed(1)),presentation:Number(pres.toFixed(1))};
  }
  if(!window._collectorConn?.open){collectorPhoneToast("NOT CONNECTED TO OPERATOR",true);return;}
  window._collectorConn.send({type:"COLLECTOR_SCORES",scores,stationId:window._collectorStation||""});
  window._collectorSent=true;
  const b=document.getElementById("collectorSendBtn");if(b){b.disabled=true;b.textContent="SCORES SENT";b.classList.add("sent");}
  document.querySelectorAll(".collectorInput").forEach(x=>x.disabled=true);
  collectorPhoneToast("ALL SCORES SENT TO OPERATOR");
}
function renderCollectorPhoneContext(ctx){
  const mat=Number(ctx.matNumber)||Number(window._collectorMat)||1;
  const judges=Number(ctx.judgeCount||0), open=!!ctx.scoringOpen;
  const incomingSession=String(ctx.sessionId||"");
  const incomingRound=Number(ctx.round||0);
  const sessionChanged=incomingSession!==String(window._collectorSessionId||"") || incomingRound!==Number(window._collectorRound||0);
  if(sessionChanged){
    window._collectorSent=false;
    window._collectorSessionId=incomingSession;
    window._collectorRound=incomingRound;
  }
  window._collectorScoringOpen=open; window._collectorJudgeCount=judges;
  const stateEl=document.getElementById("collectorState");if(stateEl)stateEl.textContent=open?"READY TO ENTER SCORES":"WAITING FOR OPERATOR TO FINISH PERFORMANCE";
  const matEl=document.getElementById("collectorMat");if(matEl)matEl.textContent=String(mat);
  const titleEl=document.getElementById("collectorMatTitle");if(titleEl)titleEl.textContent=`TAPIS ${mat}`;
  const athleteEl=document.getElementById("collectorAthlete");if(athleteEl)athleteEl.textContent=ctx.athlete||"WAITING FOR NEXT POOMSAE";
  const list=document.getElementById("collectorJudgeList");if(!list)return;
  const old={};
  if(!sessionChanged){
    list.querySelectorAll(".collectorJudgeBox").forEach(box=>{const i=box.dataset.judge;old[i]={a:document.getElementById(`collectorAcc${i}`)?.value||"",p:document.getElementById(`collectorPres${i}`)?.value||""};});
  }
  list.innerHTML=Array.from({length:judges},(_,i)=>{const j=i+1,v=old[j]||{},name=ctx.judgeNames?.[j]||`JUDGE ${j}`;return `<div class="collectorJudgeBox" data-judge="${j}"><div class="collectorJudgeTitle"><span>JUDGE ${j}</span><small>${esc(name)}</small></div><div class="collectorFields"><label>ACCURACY<input class="collectorInput" id="collectorAcc${j}" type="number" min="0" max="4" step="0.1" inputmode="decimal" placeholder="3.2" value="${esc(v.a)}" ${open?"":"disabled"}></label><label>PRESENTATION<input class="collectorInput" id="collectorPres${j}" type="number" min="1.5" max="6" step="0.1" inputmode="decimal" placeholder="4.2" value="${esc(v.p)}" ${open?"":"disabled"}></label></div></div>`;}).join("")+`<button id="collectorSendBtn" class="judgePhoneSend collectorSendBtn" ${open?"":"disabled"} onclick="collectorSendScores()">SEND SCORES</button>`;
  collectorBindValidation();
  if(open&&window._collectorSent){const b=document.getElementById("collectorSendBtn");if(b){b.disabled=true;b.textContent="SCORES SENT";b.classList.add("sent");}document.querySelectorAll(".collectorInput").forEach(x=>x.disabled=true);}
}
function renderCollector(){
  const p=new URLSearchParams(location.search);const qrMat=Number(p.get("mat"))||1;window._collectorMat=qrMat;
  document.body.innerHTML=`<div class="judgePhoneApp collectorApp"><header class="judgePhoneHeader"><img src="federation_logo_transparent.png"><div><small>FTT POOMSAE · TAPIS <span id="collectorMat">${esc(qrMat)}</span></small><strong>COLLECTOR</strong></div><span id="collectorConnection" class="judgePhoneConnection">CONNECTING</span></header><main id="collectorMain"><section class="collectorPhoneCard"><div class="phaseTag">COLLECTOR</div><h1 id="collectorMatTitle">TAPIS ${esc(qrMat)}</h1><p id="collectorAthlete">WAITING FOR NEXT POOMSAE</p><div id="collectorState" class="collectorState">WAITING FOR OPERATOR TO FINISH PERFORMANCE</div><div id="collectorJudgeList" class="collectorJudgeList"></div></section></main><div id="collectorToast" class="judgePhoneToast"></div></div>`;
  window._collectorScoringOpen=false;window._collectorSent=false;window._collectorJudgeCount=0;window._collectorSessionId="";window._collectorRound=0;
  collectorPhoneConnect({peer:p.get("peer"),token:p.get("t"),station:p.get("station")||""});
}

function renderJudgePhone(){
  const p=judgeParams();window._judgePhoneJudge=Number(p.judge)||0;window._judgePhoneName=String(STATE.judgeNames?.[p.judge]||"");ctxMatForHeader=p.mat||Number(STATE.matNumber)||1;
  document.body.innerHTML=`<div class="judgePhoneApp"><div class="judgePhoneGlow g1"></div><div class="judgePhoneGlow g2"></div><header class="judgePhoneHeader"><img src="federation_logo_transparent.png"><div><small>FTT POOMSAE · TAPIS ${esc(ctxMatForHeader||p.mat||STATE.matNumber||1)}</small><strong>JUDGE ${p.judge||"—"}</strong><em class="judgePhoneName" id="judgePhoneName">${esc(window._judgePhoneName||"")}</em></div><div class="judgePhoneHeaderActions"><span id="judgePhoneConnection" class="judgePhoneConnection">CONNECTING</span><button id="judgeFsBtn" class="judgePhoneFsBtn" onclick="judgePhoneFullscreen()" title="Plein écran">⛶</button></div></header><main id="judgePhoneMain"></main><div id="judgePhoneToast" class="judgePhoneToast"></div><div id="judgeOrientationOverlay" class="judgeOrientationOverlay"><div class="orientationIcon">↔</div><strong>TURN PHONE TO LANDSCAPE</strong><span>Le mode paysage est obligatoire pour noter.</span><button class="judgePhoneFsBtn large" onclick="judgePhoneFullscreen()">⛶ FULL SCREEN</button></div></div>`;
  window._judgePhoneAcc=4;window._judgePhoneParts={speedPower:2,rhythmTempo:2,expressionEnergy:2};window._judgePhoneSent=false;window._judgePhoneScoringOpen=false;
  judgePhoneInitControls();
  judgePhoneRenderMain({active:false,scoringOpen:false,athlete:"",club:"",poomsae:"",round:1,competition:"FTT POOMSAE"});
  judgePhoneConnect(p);
}
function judgePhoneConnect(p){
  if(typeof Peer!=="function"){judgePhoneToast("PeerJS unavailable",true);return;}
  if(!p.peer||!p.judge||!p.token){judgePhoneToast("Invalid judge QR",true);return;}
  const local=new Peer();
  const setStatus=(text,on)=>{const el=document.getElementById("judgePhoneConnection");if(el){el.textContent=text;el.classList.toggle("connected",!!on);}};
  local.on("open",()=>{
    let conn;
    try{conn=local.connect(p.peer,{reliable:true,metadata:{role:"judge",judge:p.judge,token:p.token,station:p.station||""}});}catch(e){setStatus("DISCONNECTED",false);return;}
    window._judgePhoneConn=conn;
    conn.on("open",()=>{
      setStatus("CONNECTED",true);
      judgePhoneToast("CONNECTED TO OPERATOR");
      // Explicit handshake: request the latest operator context so the phone cannot remain locked on a stale state.
      try{conn.send({type:"JUDGE_HELLO",judge:Number(p.judge),token:String(p.token),station:String(p.station||"")});}catch(_){}
    });
    conn.on("data",msg=>{
      if(msg?.type!=="CONTEXT" && msg?.type!=="SCORING_CONTEXT")return;
      ctxMatForHeader=Number(msg.matNumber)||1;
      window._judgePhoneName=String(msg.judgeNames?.[p.judge]||"");
      const nameEl=document.getElementById("judgePhoneName");if(nameEl)nameEl.textContent=window._judgePhoneName;
      const nextSession=msg.sessionId||"";
      if(nextSession!==window._judgePhoneSession){
        window._judgePhoneAcc=4;window._judgePhoneParts={speedPower:2,rhythmTempo:2,expressionEnergy:2};window._judgePhoneSent=false;
      }
      window._judgePhoneSession=nextSession;
      window._judgePhoneStation=String(msg.stationId||p.station||"");
      judgePhoneRenderMain(msg);
    });
    conn.on("close",()=>setStatus("DISCONNECTED",false));
    conn.on("error",()=>setStatus("DISCONNECTED",false));
  });
  local.on("error",()=>setStatus("DISCONNECTED",false));
  window._judgePhonePeer=local;
}

function judgePhoneRenderMain(ctx){
  const open=!!ctx.scoringOpen;
  window._judgePhoneScoringOpen=open;
  const total=Number(Object.values(window._judgePhoneParts||{speedPower:2,rhythmTempo:2,expressionEnergy:2}).reduce((s,v)=>s+v,0).toFixed(1));
  const main=document.getElementById("judgePhoneMain");if(!main)return;
  const header=`<section class="judgePhoneMatch"><div class="judgePhoneEyebrow">${esc(ctx.competition||"FTT POOMSAE")}</div><h1>${esc(ctx.athlete||"WAITING FOR NEXT POOMSAE")}</h1><p>${esc(ctx.club||"")}</p><div class="judgePhoneRound">${ctx.tieBreak?`TIE-BREAK · ${esc(ctx.poomsae||"—")}`:`ROUND ${ctx.round||1} · ${esc(ctx.poomsae||"—")}`}</div></section>`;
  const scoring=`<section class="judgeScoreCard ${open?'':'judgeScoreLocked'}"><div class="judgeScoringState">${open?'SCORING OPEN':'WAITING FOR OPERATOR'}</div><div class="scoreSectionTitle"><span>ACCURACY</span><small>STARTING SCORE</small></div><div id="judgeAccuracyValue" class="judgeAccuracyValue ${Number(window._judgePhoneAcc)>=0&&Number(window._judgePhoneAcc)<=4?"scoreValidText":"scoreInvalidText"}">${Number(window._judgePhoneAcc||4).toFixed(1)}</div><div class="accuracyControls"><div class="accuracyCol"><button type="button" class="accuracyMinus big" ${open?'':'disabled'} onclick="window.judgePhoneAdjust(-0.3)">−0.3</button><button type="button" class="accuracyPlus small" ${open?'':'disabled'} onclick="window.judgePhoneAdjust(0.3)">+0.3</button></div><div class="accuracyCol"><button type="button" class="accuracyMinus big" ${open?'':'disabled'} onclick="window.judgePhoneAdjust(-0.1)">−0.1</button><button type="button" class="accuracyPlus small" ${open?'':'disabled'} onclick="window.judgePhoneAdjust(0.1)">+0.1</button></div></div><div class="scoreSectionTitle presentationTitle"><span>PRESENTATION</span><small>3 PARAMETERS</small></div><div class="presentationParts"><div class="partCard"><b>SPEED &amp; POWER</b><div class="partControl" data-part-control="speedPower">${judgePhoneBuildValues("speedPower",open)}</div></div><div class="partCard"><b>RHYTHM &amp; TEMPO</b><div class="partControl" data-part-control="rhythmTempo">${judgePhoneBuildValues("rhythmTempo",open)}</div></div><div class="partCard"><b>EXPRESSION OF ENERGY</b><div class="partControl" data-part-control="expressionEnergy">${judgePhoneBuildValues("expressionEnergy",open)}</div></div></div><div class="presentationTotal"><span>PRESENTATION</span><strong id="judgePresentationTotal" class="${total>=1.5&&total<=6?"scoreValidText":"scoreInvalidText"}">${total.toFixed(1)}</strong></div><button id="judgePhoneSend" class="judgePhoneSend" ${open?'':'disabled'} onclick="window.judgePhoneSendScore()">SEND SCORE</button></section>`;
  const own=ctx.judgeScores?.[Number(window._judgePhoneJudge)||0]||null;
  const finalNote=(!open&&own&&Number.isFinite(Number(own.accuracy))&&Number.isFinite(Number(own.presentation)))
    ? `<section class="judgeFinalNote"><div class="judgeFinalNoteKicker">YOUR FINAL NOTE</div><div class="judgeFinalNoteGrid"><div><span>ACCURACY</span><strong>${Number(own.accuracy).toFixed(1)}</strong></div><div><span>PRESENTATION</span><strong>${Number(own.presentation).toFixed(1)}</strong></div><div class="judgeFinalNoteTotal"><span>TOTAL</span><strong>${(Number(own.accuracy)+Number(own.presentation)).toFixed(1)}</strong></div></div><small>NOTE ENREGISTRÉE PAR L’OPÉRATEUR</small></section>` : "";
  main.innerHTML=header+scoring+finalNote;
}


function renderJudge(){renderJudgePhone();}
if(judgeIsPhone())renderJudge();
else if(new URLSearchParams(location.search).get("collector")==="1")renderCollector();
else if(!new URLSearchParams(location.search).get("display")) ensureJudgePeer();
function judgeSetName(j,value){
  j=Number(j)||1;
  STATE.judgeNames=STATE.judgeNames||{};
  STATE.judgeNames[j]=String(value||"").trim();
  saveState();
  const name=document.querySelector(`.judgeQrName[data-judge-name="${j}"]`);
  if(name) name.textContent=STATE.judgeNames[j]||"NAME NOT SET";
  const items=document.querySelectorAll(`.operatorJudgeStatusItem[data-judge="${j}"] .operatorJudgeIdentity strong`);
  items.forEach(el=>el.textContent=STATE.judgeNames[j]||"NAME NOT SET");
  const box=document.querySelector(`.judgeBox[data-judge="${j}"] .operatorJudgeName`);
  if(box) box.textContent=STATE.judgeNames[j]||"NAME NOT SET";
  judgeSendContext();
}

