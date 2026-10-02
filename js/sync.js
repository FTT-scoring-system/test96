// 18. Dual Screen Synchronization
const CHANNEL_NAME="wt-poomsae-public-v2";
let bc=null;
try{bc=new BroadcastChannel(CHANNEL_NAME)}catch(e){}
function broadcast(){
  saveState();
  const payload={type:"STATE",state:STATE};
  try{bc?.postMessage(payload)}catch(e){}
  try{localStorage.setItem("wt-poomsae-sync",JSON.stringify({...payload,ts:Date.now()}))}catch(e){}
}
function broadcastTimer(){
  const payload={type:"TIMER",timer:{elapsed:STATE.timer?.elapsed||0,running:!!STATE.timer?.running,expired:!!STATE.timer?.expired}};
  try{bc?.postMessage(payload)}catch(e){}
  try{localStorage.setItem("wt-poomsae-timer",JSON.stringify({...payload,ts:Date.now()}))}catch(e){}
}
function syncIncomingTimer(next){
  if(!next?.timer)return;
  STATE.timer={...STATE.timer,...next.timer};
  updateTimerDisplays?.();
}
function syncIncoming(next){
  if(!next)return;
  STATE=next;
  render();
}
function bindSync(){
  try{bc?.addEventListener("message",e=>{
    if(e.data?.type==="STATE")syncIncoming(e.data.state);
    else if(e.data?.type==="TIMER")syncIncomingTimer(e.data);
  })}catch(e){}
  window.addEventListener("storage",e=>{
    if(e.key==="wt-poomsae-sync"&&e.newValue){try{const x=JSON.parse(e.newValue);syncIncoming(x.state)}catch(_){} }
    if(e.key==="wt-poomsae-timer"&&e.newValue){try{syncIncomingTimer(JSON.parse(e.newValue))}catch(_){} }
  });
}
