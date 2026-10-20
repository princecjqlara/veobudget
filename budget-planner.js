(function(){
  'use strict';
  const {calendar,storageKeys,defaults,textFields,calculate,estimateProfitPlateau,migrateInputs,scenarios,formulas}=BudgetModel;
  const form=document.getElementById('planner'),el=id=>document.getElementById(id);
  const money=value=>'₱'+value.toLocaleString('en-PH',{maximumFractionDigits:2});
  const preciseMoney=value=>'₱'+value.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const pct=value=>(value*100).toLocaleString('en-PH',{maximumFractionDigits:1})+'%';
  const number=value=>value.toLocaleString('en-PH',{maximumFractionDigits:4});
  const multiplierText=value=>value.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:4})+'×';
  const outcomeText=value=>value==='PROFIT'?'Profit':value==='LOSS'?'Loss':'Break-even';
  let displayedCalendarDate='';
  function setInputs(p){for(const key of Object.keys(defaults))el(key).value=p[key];}
  function getInputs(){const p={};for(const key of Object.keys(defaults)){const value=el(key).value;p[key]=textFields.includes(key)?value:value.trim()===''?NaN:Number(value);}return p;}
  function render(){
    const dates=calendar.getDates();
    displayedCalendarDate=dates.today;
    el('current-ph-date').textContent=calendar.format(dates.today,true);
    el('current-ph-date').dateTime=dates.today;
    const p=getInputs(),r=calculate(p);
    el('errors').hidden=!r.errors.length;el('errors').textContent=r.errors.join(' ');
    document.querySelector('.summary').classList.toggle('empty',r.errors.length>0);
    if(r.errors.length){
      for(const target of document.querySelectorAll('.summary dd'))target.textContent='—';
      for(const id of ['result-budget','result-per-person','result-quota','result-max-budget']){const target=el(id);if(target)target.textContent='—';}
      for(const id of ['result-date','result-reason','result-capacity-context','result-capacity-action','result-reserve','result-quota-person','result-quota-reason'])el(id).textContent='';
      for(const id of ['result-ceiling-formula','result-ceiling-note']){const target=el(id);if(target)target.textContent='';}
      el('result-date').removeAttribute('datetime');
      el('result-change').textContent='Correct the inputs to calculate.';el('result-status').textContent='Invalid inputs';el('bar-capacity').style.width='0%';window.currentBudgetResult=null;return;
    }
    el('ramp-input-note').textContent='Campaign age, not a calendar date. On Profit, each day after day 1 adds '+p.dayBoostPct+'% to the profit step (maximum '+p.maxDayBoostPct+'% boost). Today’s budget stays the base.';
    el('result-date').textContent=calendar.format(dates.tomorrow,true)+' · PH';
    el('result-date').dateTime=dates.tomorrow;
    el('result-budget').textContent=money(r.budget);
    const change=r.budget-p.currentBudget;
    el('result-change').textContent=p.currentBudget>0?(change>=0?'+':'−')+money(Math.abs(change))+' / '+(change>=0?'+':'−')+pct(Math.abs(change/p.currentBudget))+" vs today's budget":'Based on your starting budget';
    el('result-outcome').textContent=outcomeText(r.outcome);
    el('result-cpa').textContent=preciseMoney(p.yesterdayCPA);
    el('result-team-boost').textContent=r.teamBoost>0?'+'+pct(r.teamBoost)+' of base step':'None';
    el('result-day-boost').textContent=r.dayBoost>0?'+'+pct(r.dayBoost)+' on profit step':'None';
    el('result-capacity-boost').textContent=money(r.capacityAddition);
    el('result-step').textContent=(r.changeRate>=0?'+':'−')+pct(Math.abs(r.changeRate));
    el('result-multiplier').textContent=multiplierText(r.multiplier);
    el('result-candidate').textContent=money(r.candidate);
    el('result-quota').textContent=number(r.teamQuota)+' '+(r.teamQuota===1?'project':'projects');
    el('result-quota-person').textContent=number(r.quotaPerPerson)+' projects per person on average';
    el('result-quota-reason').textContent=r.teamQuota>0?'Reach this quota to keep CPA at or below '+preciseMoney(p.yesterdayCPA)+'.':'Zero ad budget: no project sales quota.';
    el('result-status').textContent=r.outcome+(r.limited?' / team limit':' / '+(r.outcome==='PROFIT'?'grow':'reduce'));
    const rule=r.outcome==='PROFIT'?'Profit: increase one '+pct(r.step)+' step.':r.outcome==='BREAK-EVEN'?'Break-even: reduce one '+pct(r.step)+' step.':'Loss: apply two successive '+pct(r.step)+' reductions.';
    el('result-reason').textContent=rule+(r.limited?' The team limit keeps projects per person below your maximum.':' Capacity adjusts to cover this budget.');
    el('result-per-person').textContent=number(r.plannedPerPerson)+' projects / day';
    el('result-capacity-context').textContent=r.rampHeld?'Starting period: capacity stays at the starting level.':r.inRamp?'Profit allows capacity to rise from the starting level to support growth.':'Automatically adjusted from tomorrow’s budget and your CPA.';
    el('result-max').textContent=number(p.maxPerPerson);
    el('result-safe-max').textContent=number(r.safeMax);
    el('result-capacity').textContent=number(r.capacity);
    el('result-acquisitions').textContent=number(r.acquisitions);
    el('result-workload').textContent=number(r.quotaPerPerson);
    el('bar-capacity').style.width=(100*r.plannedPerPerson/p.maxPerPerson)+'%';
    el('result-reserve').textContent=p.reservePct+'% reserve below your maximum.';
    el('result-capacity-action').textContent=r.limited?'To support the full '+money(r.candidate)+' growth budget, schedule '+r.neededPeople+' active people ('+Math.max(0,r.neededPeople-p.activePeople)+' more). The recommendation uses the '+p.activePeople+' people you entered.':'Your '+p.activePeople+' active people can cover the estimated workload at the automatically planned capacity.';
    if(el('result-max-budget')){
      const plateau=estimateProfitPlateau(p);
      el('result-max-budget').textContent=plateau.complete?money(plateau.budget):'Not determined';
      el('result-days-to-max').textContent=plateau.complete?number(plateau.daysToPlateau)+(plateau.daysToPlateau===1?' day':' days'):'—';
      const reachDate=plateau.complete?calendar.addDays(dates.today,plateau.daysToPlateau):null;
      el('result-max-date').textContent=!plateau.complete?'—':reachDate?calendar.format(reachDate):'Beyond date range';
      el('result-max-projects').textContent=plateau.complete?number(plateau.teamQuota):'—';
      el('result-next-profit-budget').textContent=plateau.complete?money(plateau.nextBudget):'—';
      el('result-capacity-ceiling').textContent=money(r.maximumDailyBudget);
      el('result-budget-ceiling').textContent=money(r.currentBudgetCeiling);
      const timing=plateau.complete?(plateau.daysToPlateau===0?'Your current budget is already at or above this estimate; no additional growth days are needed. ':'About '+number(plateau.daysToPlateau)+' consecutive profitable days from today’s budget. '):'';
      el('result-ceiling-formula').textContent=plateau.complete?timing+'Repeatedly applies your profit rule, starting from today’s budget and advancing campaign days. At '+money(plateau.budget)+', another profitable day recommends '+money(plateau.nextBudget)+' again. It also stays unchanged at the maximum remaining campaign-day boost.':'The projection did not establish a stable profit budget. The capacity ceiling is still shown separately.';
      el('result-ceiling-note').textContent=!plateau.complete?(plateau.errors.join(' ')||'The projection reached its simulation limit; no exact growth-stop estimate is claimed.'):plateau.reason==='capacity'?'Growth stops at the team capacity ceiling. More profit alone will not increase the budget unless you change the team, capacity, reserve, CPA, or rounding settings.':plateau.reason==='growth-disabled'?'The configured profit growth is disabled, so spending stays flat below the capacity ceiling.':'Growth stops below the capacity ceiling because the profit increase is too small to clear your '+preciseMoney(p.rounding)+' rounding unit.';
    }
    window.currentBudgetResult={inputs:p,result:r};
  }
  setInputs(defaults);
  try{
    const saved=JSON.parse(storageKeys.map(key=>localStorage.getItem(key)).find(Boolean)||'null');
    if(saved){const p=migrateInputs(saved);if(calculate(p).errors.length===0){setInputs(p);el('save-status').textContent='Saved inputs loaded.';}}
  }catch{}
  // Allow an example to open with its input values without overwriting saved inputs.
  try{
    const params=new URLSearchParams(location.search),p=getInputs();let changed=false;
    for(const key of Object.keys(defaults))if(params.has(key)){const value=params.get(key);p[key]=textFields.includes(key)?value:value.trim()===''?NaN:Number(value);changed=true;}
    if(changed&&calculate(p).errors.length===0){setInputs(p);el('save-status').textContent='Your example inputs loaded.';}
  }catch{}
  form.addEventListener('input',render);form.addEventListener('change',render);form.addEventListener('submit',event=>event.preventDefault());
  el('save').addEventListener('click',()=>{const p=getInputs();if(calculate(p).errors.length){el('save-status').textContent='Correct the inputs first.';return;}try{localStorage.setItem(storageKeys[0],JSON.stringify(p));el('save-status').textContent='Saved on this device.';}catch{el('save-status').textContent='This browser could not save inputs.';}});
  el('reset').addEventListener('click',()=>{setInputs(defaults);try{for(const key of storageKeys)localStorage.removeItem(key);}catch{}el('save-status').textContent='Default settings loaded.';render();});
  scenarios.forEach((scenario,index)=>{
    const p={...defaults,...scenario.patch},r=calculate(p),row=document.createElement('tr');
    for(const [text,numeric]of [[scenario.name,false],[outcomeText(r.outcome),true],[multiplierText(r.multiplier),true],[number(r.teamQuota),true],[money(r.budget),true]]){const cell=document.createElement('td');cell.textContent=text;if(numeric)cell.className='num';row.appendChild(cell);}
    const cell=document.createElement('td'),button=document.createElement('button');button.type='button';button.textContent='Load';button.dataset.scenario=String(index);button.setAttribute('aria-label','Load '+scenario.name);
    button.addEventListener('click',()=>{setInputs(p);render();el('save-status').textContent='Scenario loaded: '+scenario.name;form.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});cell.appendChild(button);row.appendChild(cell);el('scenarios').appendChild(row);
  });
  el('formula-text').textContent=formulas;
  el('copy-formulas').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(formulas);el('copy-status').textContent=' Copied.';}catch{el('copy-status').textContent=' Select and copy the formulas above.';}});
  render();
  const refreshCalendar=()=>{if(calendar.getDates().today!==displayedCalendarDate)render();};
  setInterval(refreshCalendar,30000);
  window.addEventListener('focus',refreshCalendar);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCalendar();});
})();
