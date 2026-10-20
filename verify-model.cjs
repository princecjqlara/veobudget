const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const modelSource = fs.readFileSync(path.join(__dirname,'budget-model.js'),'utf8');
function loadModel(profile='aggressive',plannerId=profile){
  const sandbox={document:{documentElement:{dataset:{plannerProfile:profile,plannerId}}}};
  vm.createContext(sandbox);
  vm.runInContext(modelSource,sandbox);
  return sandbox.BudgetModel;
}
const {defaults,calculate,migrateInputs,scenarios}=loadModel();
// Keep the established calculation scenarios independent of the visitor defaults.
const fixture={...defaults,currentBudget:2000,day:4,activePeople:10,maxPerPerson:3};
const run=patch=>calculate({...fixture,...patch});
let checks=0;
function near(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-7,message+': '+actual);checks++;}
const visitorDefault=calculate(defaults);
near(defaults.currentBudget,2800,'New visitors start with the agreed budget');
near(defaults.activePeople,5,'New visitors start with the agreed team');
near(defaults.maxPerPerson,3.5,'New visitors start with the agreed maximum');
near(defaults.day,1,'New visitors start at campaign day one');
near(visitorDefault.budget,4660,'Published defaults recommend 4660');
near(visitorDefault.teamQuota,12,'Published defaults show a twelve-project quota');
const profit=run({});
near(profit.baseStep,.5,'Aggressive base step');
near(profit.teamBoost,.18,'Ten people add an eighteen percent boost to the profit step');
near(profit.dayBoost,.15,'Campaign day four boosts the profit step');
near(profit.capacityAddition,1320,'Unused capacity provides a growth allowance');
near(profit.step,1.40635,'Total growth includes the performance and capacity allowance');
near(profit.multiplier,2.40635,'Profit multiplier includes all growth factors');
near(profit.budget,4810,'Profit uses available team capacity');
near(profit.plannedPerPerson,1.43,'Capacity covers the whole-project quota');
near(profit.acquisitions,12.025,'Entered CPA determines acquisitions');
near(profit.teamQuota,13,'Sales quota is rounded up to whole projects');
near(profit.quotaPerPerson,1.3,'Quota per person is the team average');
near(run({profitLiftPct:0}).budget,4670,'Profit lift can be disabled');
near(run({yesterdayResult:'BREAK-EVEN',profitLiftPct:50}).budget,1000,'Profit lift does not alter break-even reductions');
near(run({yesterdayResult:'LOSS',profitLiftPct:50}).budget,500,'Profit lift does not alter loss reductions');
near(run({yesterdayResult:'BREAK-EVEN'}).budget,1000,'Break-even down one step');
near(run({yesterdayResult:'LOSS'}).budget,500,'Loss down two compounded steps');
near(run({currentBudget:1000}).budget,3460,'Low budget can use available team capacity');
near(run({currentBudget:5000}).budget,8000,'Higher budget grows');
near(run({currentBudget:5000}).plannedPerPerson,2.2,'Higher budget raises capacity per person');
near(run({currentBudget:10000}).budget,10800,'Budget respects reserved capacity');
near(run({currentBudget:10000}).plannedPerPerson,2.7,'Capacity stays below the maximum of three');
near(run({yesterdayCPA:200}).budget,4000,'CPA affects the capacity-based spending allowance');
near(run({yesterdayCPA:200}).plannedPerPerson,2.2,'Lower CPA raises project workload');
near(run({yesterdayCPA:100}).budget,2700,'CPA input controls the capacity budget');
near(run({yesterdayCPA:100,maxPerPerson:5}).budget,3860,'Larger entered maximum unlocks growth');
near(run({yesterdayCPA:100,maxPerPerson:5}).plannedPerPerson,4.29,'Capacity adjusts without reaching five');
near(run({day:2}).plannedPerPerson,1.32,'Profit can raise starting capacity');
near(run({day:2,currentBudget:5000}).budget,7810,'Starting period does not suppress profitable growth');
near(run({day:2,yesterdayResult:'BREAK-EVEN'}).plannedPerPerson,.8,'Non-profit starting capacity remains at baseline');
const userExample=run({currentBudget:2800,startingBudget:2000,day:1,activePeople:5,maxPerPerson:3.5,yesterdayCPA:400});
near(userExample.budget,4660,'Five-person example includes unused capacity growth');
near(userExample.capacityAddition,480,'Five-person capacity allowance is visible');
near(userExample.plannedPerPerson,2.64,'Capacity grows to cover the project quota');
near(userExample.acquisitions,11.65,'User CPA forecasts 11.65 projects');
near(userExample.teamQuota,12,'User must aim for twelve project sales to meet CPA');
near(userExample.quotaPerPerson,2.4,'User quota averages 2.4 projects per person');
const largerTeam=run({currentBudget:2800,startingBudget:2000,day:1,activePeople:10,maxPerPerson:3.5,yesterdayCPA:400});
near(largerTeam.budget,5750,'A larger active team unlocks meaningful extra growth');
near(largerTeam.capacityAddition,1440,'More active people grow the capacity allowance');
assert.ok(largerTeam.budget>userExample.budget*1.2,'Doubling the example team gives a material budget increase');checks++;
const agedExample={currentBudget:2800,startingBudget:2000,activePeople:5,maxPerPerson:3.5,yesterdayCPA:400};
near(run({...agedExample,day:5}).budget,4940,'Campaign day five increases the profit budget');
near(run({...agedExample,day:10}).budget,5280,'Campaign day ten increases the profit budget further');
near(run({day:100}).dayBoost,1,'Campaign day boost is bounded');
near(run({yesterdayResult:'LOSS',day:100}).dayBoost,0,'Calendar age does not increase loss spending');
near(run({yesterdayResult:'BREAK-EVEN',day:100}).capacityAddition,0,'Capacity allowance applies only on profit');
near(run({activePeople:1}).teamBoost,0,'First active person has no extra-person boost');
near(run({activePeople:100}).teamBoost,.25,'Team boost is capped');
near(run({activePeople:100,yesterdayResult:'LOSS'}).teamBoost,0,'Loss receives no profit boost');
near(run({activePeople:100,yesterdayResult:'BREAK-EVEN'}).teamBoost,0,'Break-even receives no profit boost');
near(run({peopleBoostPct:0}).budget,4580,'Small team bonus can be disabled independently');
near(run({capacityFillPct:0,dayBoostPct:0}).budget,3290,'New growth allowances can be disabled independently');
assert.ok(userExample.budget>2800&&userExample.budget>2000,'Profit exceeds both current and starting budgets when the team can support it');checks++;
assert.ok(userExample.plannedPerPerson<3.5,'The user maximum is preserved');checks++;
near(run({activePeople:0}).budget,0,'No active people means zero budget');
near(run({activePeople:0}).plannedPerPerson,0,'No active people means no planned workload');
near(run({maxPerPerson:.5}).plannedPerPerson,.45,'Small maximum also keeps a reserve');
near(run({currentBudget:0}).referenceBudget,2000,'Starting budget is used when current budget is zero');
for(const patch of [{yesterdayCPA:0},{maxPerPerson:0},{activePeople:1.5},{reservePct:0},{reservePct:100},{yesterdayResult:''},{maxStepPct:100},{currentBudget:NaN},{rounding:0},{peopleBoostPct:11},{maxPeopleBoostPct:51},{dayBoostPct:21},{maxDayBoostPct:201},{capacityFillPct:51}]){assert.ok(run(patch).errors.length>0);checks++;}
const migrated=migrateInputs({currentBudget:5000,activePeople:12,perPerson:2,baselineCPA:350,backlogTotal:100,cashLimit:1});
near(migrated.currentBudget,5000,'Saved budget preserved');
near(migrated.maxPerPerson,2,'Old per-person limit preserved');
near(migrated.yesterdayCPA,350,'Previous CPA prefilled');
assert.equal(Object.hasOwn(migrated,'backlogTotal'),false);checks++;
assert.equal(Object.hasOwn(migrated,'cashLimit'),false);checks++;
const current=migrateInputs({...defaults,yesterdayCPA:280,maxPerPerson:4,reservePct:15});
near(current.yesterdayCPA,280,'New CPA saves correctly');
near(current.reservePct,15,'New reserve saves correctly');
let previousCapacity=0,previousMultiplier=Infinity;
for(const currentBudget of [1,100,500,1000,2000,5000,10000,20000,100000]){
  const r=run({currentBudget});
  assert.ok(r.plannedPerPerson>=previousCapacity-1e-7,'Capacity must not fall when profitable budget rises');checks++;
  assert.ok(r.multiplier<=previousMultiplier+1e-7,'Percentage increase must not rise with budget');checks++;
  previousCapacity=r.plannedPerPerson;previousMultiplier=r.multiplier;
}
for(const currentBudget of [0,500,2000,10000,100000])for(const activePeople of [0,1,10])for(const maxPerPerson of [.5,3,10])for(const yesterdayCPA of [100,400])for(const yesterdayResult of ['PROFIT','BREAK-EVEN','LOSS'])for(const day of [2,4]){
  const p={...defaults,currentBudget,activePeople,maxPerPerson,yesterdayCPA,yesterdayResult,day},r=calculate(p);
  assert.equal(r.errors.length,0);
  assert.ok(Number.isFinite(r.budget)&&r.budget>=0);
  assert.ok(r.budget<=r.candidate+1e-7);
  assert.ok(r.budget<=r.budgetLimit+1e-7);
  assert.ok(r.plannedPerPerson<p.maxPerPerson,'Never plan the full maximum');
  assert.ok(r.plannedPerPerson<=r.safeMax+1e-7);
  assert.ok(r.acquisitions<=r.capacity+1e-7,'Capacity must cover expected acquisitions');
  assert.ok(Number.isInteger(r.teamQuota)&&r.teamQuota>=r.acquisitions-1e-7,'Quota rounds up to whole projects');
  assert.ok(r.teamQuota<=r.capacity+1e-7,'Whole project quota fits the planned capacity');
  assert.ok(r.teamQuota<=r.wholeProjectCapacity,'Whole project quota fits reserved maximum capacity');
  if(r.teamQuota>0)assert.ok(r.budget/r.teamQuota<=p.yesterdayCPA+1e-7,'Meeting quota must meet the CPA target');
  if(activePeople>0)near(r.quotaPerPerson*activePeople,r.teamQuota,'Per-person average reconciles with team quota');
  assert.ok(Number.isFinite(r.neededPeople));
  checks+=12;
}
let previousBudget=0;
for(const activePeople of [1,2,3,4,5,10,14,20]){
  const r=run({currentBudget:2800,activePeople,maxPerPerson:3.5});
  assert.ok(r.budget>=previousBudget,'More active people must not reduce a profitable budget');checks++;
  previousBudget=r.budget;
}
const conservative=loadModel('conservative');
const conservativeDefault=conservative.calculate(conservative.defaults);
assert.equal(conservative.profile,'conservative');checks++;
assert.equal(loadModel().profile,'aggressive');checks++;
assert.equal(loadModel('unknown').profile,'aggressive');checks++;
near(conservative.defaults.maxPerPerson,1.6,'Page 2 starts at the editable maximum of 1.6');
near(conservativeDefault.budget,2400,'Conservative defaults respect the lower capacity ceiling');
near(conservativeDefault.teamQuota,6,'Conservative defaults show a six-project quota');
near(conservativeDefault.quotaPerPerson,1.2,'Conservative quota averages 1.2 projects per person');
near(conservativeDefault.plannedPerPerson,1.28,'Conservative capacity keeps its reserve when the workload buffer is capped');
near(conservativeDefault.capacityAddition,0,'No unused-capacity allowance is added above the team ceiling');
near(conservativeDefault.safeMax,1.28,'Conservative capacity keeps a twenty percent reserve');
near(conservativeDefault.maximumTeamProjects,6,'Capacity ceiling rounds down to whole projects');
near(conservativeDefault.maximumDailyBudget,2400,'Estimated maximum daily budget uses reserved capacity and CPA');
near(conservativeDefault.currentBudgetCeiling,2400,'Profitable planning can use the full reserved ceiling');
near(conservativeDefault.baseStep,6/43,'Conservative base step independently simplifies to 6/43');
near(conservativeDefault.performanceStep,156/1075,'Conservative performance step includes a four percent team boost');
near(conservativeDefault.changeRate,-1/7,'Capacity can reduce a profitable recommendation when the current budget is already too high');
const conservativeLoss=conservative.calculate({...conservative.defaults,yesterdayResult:'LOSS'});
near(conservativeLoss.multiplier,(37/43)**2,'Loss compounds two base-step reductions');
near(conservativeLoss.budget,1200,'Starting-period capacity can override the loss percentage');
near(conservativeLoss.changeRate,-4/7,'Final loss change includes the starting-period cap');
near(conservativeLoss.maximumDailyBudget,2400,'Maximum team ceiling is independent of the latest result');
near(conservativeLoss.currentBudgetCeiling,1200,'Current planning ceiling reflects the starting-period restriction');
const conservativeLaterLoss=conservative.calculate({...conservative.defaults,yesterdayResult:'LOSS',day:8});
near(conservativeLaterLoss.budget,2070,'Loss after the starting period follows compounded reductions and rounding');
near(conservativeLaterLoss.changeRate,2070/2800-1,'Final loss change includes both reductions');
near(conservative.calculate({...conservative.defaults,maxPerPerson:3.5,rounding:.01}).budget,3290.32,'The editable maximum can unlock a larger budget with cent-level rounding');
for(const [patch,expected] of [[{activePeople:0},0],[{activePeople:10},4800],[{yesterdayCPA:200},1200],[{maxPerPerson:3.5},5600],[{reservePct:50},1600],[{rounding:700},2100]]){
  near(conservative.calculate({...conservative.defaults,...patch}).maximumDailyBudget,expected,'Budget ceiling updates with '+JSON.stringify(patch));
}
for(const patch of [{currentBudget:100},{day:100},{baseStepPct:200},{headroomPct:100},{yesterdayResult:'BREAK-EVEN'},{yesterdayResult:'LOSS'}]){
  near(conservative.calculate({...conservative.defaults,...patch}).maximumDailyBudget,2400,'Growth rules and fitted headroom do not raise the reserved capacity ceiling');
}
assert.ok(conservative.calculate({...conservative.defaults,activePeople:1e308}).errors.length>0,'Overflow must not produce a NaN recommendation');checks++;
assert.ok(conservative.calculate({...conservative.defaults,yesterdayCPA:1e308}).errors.length>0,'Overflow in the spending ceiling must be rejected');checks++;
for(const key of ['currentBudget','startingBudget','yesterdayCPA','activePeople','day','rounding']){
  assert.equal(conservative.defaults[key],defaults[key],'Business inputs stay comparable: '+key);checks++;
}
for(const key of ['baseStepPct','minStepPct','maxStepPct','taperBudget','peopleBoostPct','maxPeopleBoostPct','profitLiftPct','dayBoostPct','maxDayBoostPct','capacityFillPct','rampPerPerson']){
  assert.ok(conservative.defaults[key]<defaults[key],'Conservative growth setting is lower: '+key);checks++;
}
for(const key of ['reservePct','headroomPct','rampDays']){
  assert.ok(conservative.defaults[key]>defaults[key],'Conservative protection setting is higher: '+key);checks++;
}
assert.equal(conservative.storageKeys.length,1);checks++;
assert.ok(conservative.storageKeys.every(key=>!loadModel().storageKeys.includes(key)),'Profiles must not share saved inputs');checks++;
assert.match(conservative.formulas,/BaseStep = 40%/);checks++;
assert.match(conservative.formulas,/Reserve = 20%/);checks++;
assert.match(conservative.formulas,/RampDays = 7/);checks++;
assert.match(conservative.formulas,/MaxPerPerson = 1.6/);checks++;
assert.match(loadModel().formulas,/BaseStep = 100%/);checks++;
assert.equal(conservative.migrateInputs({currentBudget:5000}).baseStepPct,40,'Partial saves inherit the selected profile');checks++;
near(conservative.migrateInputs({...conservative.defaults,maxPerPerson:2.2}).maxPerPerson,2.2,'Saved custom capacity remains editable and is not overwritten');
near(conservative.calculate({...conservative.defaults,day:100}).dayBoost,.2,'Conservative day boost is capped');
near(conservative.calculate({...conservative.defaults,activePeople:100}).teamBoost,.1,'Conservative team boost is capped');
near(conservative.calculate({...conservative.defaults,day:7,yesterdayResult:'BREAK-EVEN'}).plannedPerPerson,.6,'Conservative starting period protects capacity for seven days');
assert.equal(conservative.calculate({...conservative.defaults,day:8,yesterdayResult:'BREAK-EVEN'}).rampHeld,false);checks++;
for(const currentBudget of [0,500,2800,10000,100000])for(const activePeople of [0,1,5,10])for(const yesterdayCPA of [100,400])for(const yesterdayResult of ['PROFIT','BREAK-EVEN','LOSS'])for(const day of [1,7,8,100]){
  const inputs={...conservative.defaults,currentBudget,activePeople,yesterdayCPA,yesterdayResult,day};
  const result=conservative.calculate(inputs);
  assert.equal(result.errors.length,0);
  assert.ok(Number.isFinite(result.budget)&&result.budget>=0);
  assert.ok(result.budget<=result.candidate+1e-7);
  assert.ok(result.budget<=result.budgetLimit+1e-7);
  assert.ok(result.plannedPerPerson<inputs.maxPerPerson);
  assert.ok(result.plannedPerPerson<=result.safeMax+1e-7);
  assert.ok(Number.isInteger(result.teamQuota)&&result.teamQuota>=result.acquisitions-1e-7);
  assert.ok(result.teamQuota<=result.capacity+1e-7);
  assert.ok(result.teamQuota<=result.wholeProjectCapacity);
  assert.ok(result.budget<=result.currentBudgetCeiling+1e-7);
  assert.ok(result.currentBudgetCeiling<=result.maximumDailyBudget+1e-7);
  if(yesterdayResult==='PROFIT')assert.ok(result.budget<=calculate({...defaults,currentBudget,activePeople,yesterdayCPA,yesterdayResult,day}).budget,'Conservative profit never outgrows Page 1 for matching inputs');
  checks+=11;
}
for(const scenario of conservative.scenarios){
  assert.equal(conservative.calculate({...conservative.defaults,...scenario.patch}).errors.length,0);checks++;
  assert.equal(scenario.patch.maxPerPerson??conservative.defaults.maxPerPerson,1.6,'Page 2 examples retain the new capacity default');checks++;
}
const suno=loadModel('aggressive','suno');
assert.equal(suno.profile,'aggressive');checks++;
assert.equal(JSON.stringify(suno.defaults),JSON.stringify(defaults),'Suno defaults must exactly match Page 1');checks++;
assert.equal(suno.formulas,loadModel().formulas,'Suno formulas must exactly match Page 1');checks++;
assert.equal(JSON.stringify(suno.scenarios),JSON.stringify(scenarios),'Suno scenarios must exactly match Page 1');checks++;
assert.equal(suno.storageKeys.length,1);checks++;
assert.ok(suno.storageKeys.every(key=>!loadModel().storageKeys.includes(key)&&!conservative.storageKeys.includes(key)),'Suno saves must stay separate from both existing pages');checks++;
near(suno.calculate(suno.defaults).budget,4660,'Suno starts with the Page 1 budget');
near(suno.calculate(suno.defaults).teamQuota,12,'Suno starts with the Page 1 quota');
for(const currentBudget of [0,1000,2800,10000])for(const activePeople of [0,1,5,10])for(const yesterdayCPA of [200,400])for(const yesterdayResult of ['PROFIT','BREAK-EVEN','LOSS'])for(const day of [1,4,100]){
  const inputs={...defaults,currentBudget,activePeople,yesterdayCPA,yesterdayResult,day};
  assert.equal(JSON.stringify(suno.calculate(inputs)),JSON.stringify(calculate(inputs)),'Suno calculations must exactly match Page 1');checks++;
}
const rows=scenarios.map(s=>{const r=calculate({...defaults,...s.patch});return {name:s.name,result:r.outcome,multiplier:r.multiplier,teamBoost:r.teamBoost,budget:r.budget,projectsPerPerson:r.plannedPerPerson,estimatedProjects:r.acquisitions,teamQuota:r.teamQuota,averageQuota:r.quotaPerPerson,teamCapacity:r.capacity};});
fs.mkdirSync(path.join(__dirname,'.qa'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'.qa','verified-scenarios.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify({checks,conservativeDefault:{budget:conservativeDefault.budget,teamQuota:conservativeDefault.teamQuota,quotaPerPerson:conservativeDefault.quotaPerPerson},scenarios:rows},null,2));
