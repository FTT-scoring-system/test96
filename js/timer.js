// 7. Timer + 8. Audio — V8 robust pause/resume/reset
let timerInterval=null;
function fmtTime(s){s=Math.max(0,Math.floor(s));return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function remainingTime(){return Math.max(0,WT_DATA.limits.timeSeconds-Math.floor(STATE.timer?.elapsed||0))}
function timerBeep(){
  try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C(),o=c.createOscillator(),g=c.createGain();o.type="sine";o.frequency.value=880;g.gain.value=.16;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.5)}catch(e){}
}
function runTimerInterval(){
  clearInterval(timerInterval);
  timerInterval=setInterval(()=>{
    if(!STATE.timer?.running)return;
    STATE.timer.elapsed=Math.min(WT_DATA.limits.timeSeconds,Math.floor(STATE.timer.elapsed||0)+1);
    if(STATE.timer.elapsed>=WT_DATA.limits.timeSeconds){
      STATE.timer.expired=true;STATE.timer.running=false;const isTie=STATE.state===STATES.TIE_BREAK_RUNNING;STATE.state=isTie?STATES.TIE_BREAK_CALCULATING:STATES.TIME_FINISHED;STATE.publicMode=isTie?"tie":"running";timerBeep();broadcast();render();clearInterval(timerInterval);return;
    }
    broadcastTimer();updateTimerDisplays?.();updateOperatorTimerDisplay?.();
  },1000);
}
function startTimer(){
  clearInterval(timerInterval);const isTie=STATE.state===STATES.TIE_BREAK_RUNNING;STATE.timer={elapsed:0,running:true,expired:false};STATE.state=isTie?STATES.TIE_BREAK_RUNNING:STATES.ROUND_RUNNING;STATE.publicMode=isTie?"tie":"running";broadcast();render();runTimerInterval();
}
function resumeTimer(){
  if(STATE.timer?.expired)return false;
  const isTie=STATE.state===STATES.TIE_BREAK_RUNNING;
  STATE.timer={...STATE.timer,running:true};STATE.state=isTie?STATES.TIE_BREAK_RUNNING:STATES.ROUND_RUNNING;STATE.publicMode=isTie?"tie":"running";broadcast();render();runTimerInterval();return true;
}
function pauseTimer(){
  if(!STATE.timer?.running)return false;
  STATE.timer.running=false;clearInterval(timerInterval);broadcast();render();return true;
}
function stopTimer(){STATE.timer.running=false;clearInterval(timerInterval);broadcast();render()}
function resetTimer(){clearInterval(timerInterval);STATE.timer={elapsed:0,running:false,expired:false};broadcast();render()}
function pausePerformance(){pauseTimer()}
function resumePerformance(){resumeTimer()}
function resetPerformanceTimer(){
  if(![STATES.ROUND_RUNNING,STATES.TIME_FINISHED,STATES.TIE_BREAK_RUNNING,STATES.TIE_BREAK_CALCULATING,STATES.ATHLETE_READY,STATES.ROUND_2_READY].includes(STATE.state))return;
  clearInterval(timerInterval);STATE.timer={elapsed:0,running:false,expired:false};
  if(STATE.state===STATES.ROUND_RUNNING||STATE.state===STATES.TIME_FINISHED)STATE.state=STATE.currentRound===2?STATES.ROUND_2_READY:STATES.ATHLETE_READY;
  STATE.publicMode="ready";broadcast();render();
}
