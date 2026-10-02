// 9. Scoring Engine
function scoreToNumber(v){return Number(String(v).replace(",", "."))}
function validScore(a,p){
  return Number.isFinite(a)&&Number.isFinite(p)&&a>=0&&a<=4&&p>=1.5&&p<=6;
}
function exclusionIndexes(values){
  const n=values.length;
  if(n<5)return new Set();
  let min=Math.min(...values),max=Math.max(...values),out=new Set();
  // Exactly one occurrence of each extreme is excluded.
  for(let i=0;i<n;i++)if(values[i]===min){out.add(i);break}
  for(let i=n-1;i>=0;i--)if(values[i]===max&&!out.has(i)){out.add(i);break}
  return out;
}
function mean(values,excluded=new Set()){
  const kept=values.filter((_,i)=>!excluded.has(i));
  return kept.reduce((s,v)=>s+v,0)/kept.length;
}
function calculateRound(judges,penalty=0,removeExtremes=true){
  const accuracy=judges.map(j=>j.accuracy),presentation=judges.map(j=>j.presentation);
  const ae=removeExtremes?exclusionIndexes(accuracy):new Set();
  const pe=removeExtremes?exclusionIndexes(presentation):new Set();
  const av=mean(accuracy,ae),pv=mean(presentation,pe);
  const penaltyValue=Math.max(0,Number(penalty)||0);
  return {judges:judges.map(j=>({accuracy:j.accuracy,presentation:j.presentation})),
    accuracy:av,presentation:pv,total:av+pv-penaltyValue,
    penalty:penaltyValue,penaltyCount:Math.round(penaltyValue/0.3),
    accuracyExcluded:[...ae],presentationExcluded:[...pe],calculatedAt:new Date().toISOString()};
}
function calculateWithoutExtremes(round){return calculateRound(round.judges,Number(round?.penalty)||0,false)}
function finalScore(r1,r2){
  return ((Number(r1?.total)||0) + (Number(r2?.total)||0))/2;
}
function fmt3(v){return Number(v).toFixed(3)}
