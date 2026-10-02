// 17. Local Storage / Competition State
const STORAGE_KEY="wt-poomsae-professional-v2";
const STATES={IDLE:"IDLE",ATHLETE_READY:"ATHLETE_READY",ROUND_RUNNING:"ROUND_RUNNING",TIME_FINISHED:"TIME_FINISHED",
CALCULATING:"CALCULATING",RESULT_READY:"RESULT_READY",ROUND_2_READY:"ROUND_2_READY",FINAL_RESULT:"FINAL_RESULT",
NEXT_ATHLETE:"NEXT_ATHLETE",TIE_BREAK_READY:"TIE_BREAK_READY",TIE_BREAK_RUNNING:"TIE_BREAK_RUNNING",TIE_BREAK_CALCULATING:"TIE_BREAK_CALCULATING",QUALIFIED:"QUALIFIED",RESULTS:"RESULTS",PODIUM:"PODIUM"};
function newState(){
  return {version:5,setupComplete:false,competitionStarted:false,competitionName:"POOMSAE CHAMPIONSHIP",classCode:"B",category:"Cadet",gender:"",participation:"INDIVIDUAL",
    phase:"DIRECT FINAL",athleteCount:8,judgeCount:3,matCount:1,matNumber:1,judgeNames:{},athletes:[],currentIndex:0,currentRound:1,
    timer:{elapsed:0,running:false,expired:false},state:STATES.IDLE,publicMode:"ready",
    publishedResult:null,tieResolutions:{},tieBreak:{active:false,athleteIds:[],poomsae:"",stage:"",scores:{}},audioEnabled:true,rankings:[],qualifiedSnapshot:[],history:[],resultsLog:[],fixedPoomsae:{semi:{round1:"",round2:""},final:{round1:"",round2:""},round1:"",round2:""},setupDraft:null,judgeQr:{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}},collectorQr:{peerId:"",token:"",deleted:false},stationId:""};
}
let STATE=loadState();
function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");
    const next=Object.assign(newState(),raw);
    if(next.state==="TIE_BREAK"||next.state==="RANKING")next.state=STATES.QUALIFIED;
    next.tieBreak=next.tieBreak||{active:false,athleteIds:[],poomsae:"",stage:"",scores:{}};
    return next;
  }catch(e){return newState()}
}
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(STATE));
  }catch(e){
    // localStorage is the primary offline persistence mechanism; ignore quota errors.
  }
}
function confirmAction(msg){return window.confirm(msg)}
function logEvent(type,data={}){STATE.history=Array.isArray(STATE.history)?STATE.history:[];STATE.history.push({type,at:new Date().toISOString(),athleteId:currentAthlete?.()?.id||null,...data});if(STATE.history.length>1000)STATE.history=STATE.history.slice(-1000);saveState()}
function resetCategoryData(){
  if(!confirmAction("RESET CATEGORY ? Toutes les données de cette catégorie seront supprimées.")) return false;
  STATE.athletes=[];STATE.currentIndex=0;STATE.currentRound=1;STATE.rankings=[];STATE.publishedResult=null;STATE.tieResolutions={};STATE.tieBreak={active:false,athleteIds:[],poomsae:"",stage:"",scores:{}};
  STATE.state=STATES.IDLE;STATE.publicMode="ready";STATE.timer={elapsed:0,running:false,expired:false};saveState();broadcast();return true;
}
function newCompetition(){
  if(!confirmAction("NEW COMPETITION ? Toutes les données de la compétition seront effacées.")) return false;
  STATE=newState();saveState();broadcast();return true;
}
function backToInitialSetup(){
  // Returning to setup is the normal workflow for starting another category.
  // Do not ask for confirmation here; the operator explicitly clicked BACK TO SETUP.
  const liveJudgeQr=STATE.judgeQr||{peerId:"",tokens:{},deleted:{},sessionId:"",scores:{}};
  const liveCollectorQr=STATE.collectorQr||{peerId:"",token:"",deleted:false};
  const keep={competitionName:STATE.competitionName,classCode:STATE.classCode,category:STATE.category,gender:STATE.gender,participation:STATE.participation||"INDIVIDUAL",judgeCount:STATE.judgeCount,matNumber:STATE.matNumber||1,judgeNames:STATE.judgeNames||{}};
  STATE=newState(); Object.assign(STATE,keep);
  // Keep the live Peer/QR identity so already-connected judge phones stay connected
  // while the operator configures the next category. The scoring session itself is reset.
  STATE.judgeQr={...liveJudgeQr,sessionId:"",scores:{}};
  STATE.collectorQr={...liveCollectorQr};
  STATE.setupComplete=false; STATE.competitionStarted=false; STATE.setupDraft=null; STATE.fixedPoomsae={semi:{round1:"",round2:""},final:{round1:"",round2:""},round1:"",round2:""};
  saveState(); broadcast();
  if(typeof render==='function') render();
  setTimeout(()=>typeof openCompetitionSetup==='function'&&openCompetitionSetup(),50);
  return true;
}

function currentAthlete(){return STATE.athletes[STATE.currentIndex]||null}
function displayPoomsae(a,round=STATE.currentRound){const key=a?.rounds?.[round-1]?.poomsae;return key?WT_DATA.poomsae[key]:"—"}
