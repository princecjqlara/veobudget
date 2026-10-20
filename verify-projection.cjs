const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'budget-model.js'), 'utf8');
let checks = 0;
let seed = 19337;
const choose = values => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;return values[seed % values.length];};

function simulateProfitDays(model, inputs) {
  const saturatedDay = inputs.dayBoostPct > 0 ? Math.max(inputs.day, 1 + Math.ceil(inputs.maxDayBoostPct / inputs.dayBoostPct)) : inputs.day;
  let state = {...inputs, yesterdayResult: 'PROFIT'};
  const budgets = [inputs.currentBudget];
  for (let dayIndex = 0; dayIndex < 2000; dayIndex++) {
    const result = model.calculate(state);
    assert.equal(result.errors.length, 0);
    budgets.push(result.budget);
    if (state.day >= saturatedDay && result.budget === state.currentBudget) return {budget: result.budget, daysToPlateau: budgets.findIndex(budget => budget >= result.budget)};
    state = {...state, currentBudget: result.budget, day: state.day + 1};
  }
  throw new Error('Direct daily simulation did not settle.');
}

for (const [profile, plannerId] of [['aggressive', 'aggressive'], ['conservative', 'conservative'], ['aggressive', 'suno']]) {
  const context = {document: {documentElement: {dataset: {plannerProfile: profile, plannerId}}}};
  vm.runInNewContext(source, context);
  const model = context.BudgetModel;
  const defaultProjection = model.estimateProfitPlateau(model.defaults);
  assert.equal(defaultProjection.complete, true);checks++;
  assert.equal(defaultProjection.budget, model.calculate(model.defaults).maximumDailyBudget);checks++;
  assert.equal(defaultProjection.nextBudget, defaultProjection.budget);checks++;
  assert.equal(defaultProjection.maximumBoostBudget, defaultProjection.budget);checks++;
  assert.equal(defaultProjection.daysToPlateau, profile === 'conservative' ? 0 : 2);checks++;
  const cases = [{}, {currentBudget: 0}, {activePeople: 0}, {yesterdayResult: 'LOSS'}, {currentBudget: 100000}];
  for (let index = 0; index < 64; index++) cases.push({
    currentBudget: choose([0, 10, 500, 1000, 2800, 10000]), activePeople: choose([0, 1, 5, 10]),
    maxPerPerson: choose([0.5, 1.6, 3.5]), yesterdayCPA: choose([200, 400]),
    rounding: choose([0.01, 10, 100, 700]), day: choose([1, 7, 22]),
    baseStepPct: choose([0, 40]), minStepPct: choose([0, 5]), capacityFillPct: choose([0, 3, 15])
  });
  for (const patch of cases) {
    const inputs = Object.freeze({...model.defaults, ...patch});
    const projection = model.estimateProfitPlateau(inputs);
    assert.equal(projection.complete, true, plannerId + ' projection must finish');
    const expected = simulateProfitDays(model, inputs);
    assert.equal(projection.budget, expected.budget, plannerId + ' projection must match actual consecutive profit days');
    assert.equal(projection.daysToPlateau, expected.daysToPlateau, plannerId + ' days must count the first reach, not later verification or loop iterations');
    assert.equal(projection.nextBudget, projection.budget);
    assert.equal(projection.maximumBoostBudget, projection.budget);
    assert.ok(projection.budget <= projection.capacityCeiling);
    checks += 6;
  }
  assert.equal(model.estimateProfitPlateau({...model.defaults, yesterdayCPA: 0}).complete, false);checks++;
  assert.equal(model.estimateProfitPlateau({...model.defaults, activePeople: 1e308}).complete, false);checks++;
}

const conservativeContext = {document: {documentElement: {dataset: {plannerProfile: 'conservative'}}}};
vm.runInNewContext(source, conservativeContext);
const model = conservativeContext.BudgetModel;
const roundingInputs = {...model.defaults, currentBudget: 1000, baseStepPct: 0, minStepPct: 0, maxStepPct: 0};
const roundingStop = model.estimateProfitPlateau(roundingInputs);
assert.equal(roundingStop.budget, 2070);checks++;
assert.equal(roundingStop.capacityCeiling, 2400);checks++;
assert.equal(roundingStop.nextBudget, 2070);checks++;
assert.equal(roundingStop.reason, 'rounding');checks++;
assert.equal(roundingStop.daysToPlateau, 62);checks++;
const disabledStop = model.estimateProfitPlateau({...roundingInputs, capacityFillPct: 0});
assert.equal(disabledStop.budget, 1000);checks++;
assert.equal(disabledStop.reason, 'growth-disabled');checks++;
assert.equal(disabledStop.daysToPlateau, 0);checks++;
const temporaryStall = {...model.defaults, currentBudget: 1000, rounding: 100, baseStepPct: 10, minStepPct: 0, maxStepPct: 99, taperBudget: 1e9, peopleBoostPct: 0, profitLiftPct: 0, capacityFillPct: 0, dayBoostPct: 5, maxDayBoostPct: 100};
assert.equal(model.calculate(temporaryStall).budget, 1000);checks++;
assert.equal(model.estimateProfitPlateau(temporaryStall).budget, 2400, 'A temporary stall must not hide later campaign-day growth');checks++;
const distantBoost = model.estimateProfitPlateau({...temporaryStall, dayBoostPct: 1e-8});
assert.equal(distantBoost.complete, true);checks++;
assert.equal(distantBoost.budget, 2400);checks++;
assert.ok(distantBoost.day > 100, 'Flat periods must be advanced without mistaking them for a final plateau');checks++;
assert.ok(distantBoost.daysToPlateau > 100, 'Skipped waiting days must still count toward the time estimate');checks++;
const limited = model.estimateProfitPlateau(roundingInputs, 1);
assert.equal(limited.complete, false);checks++;
assert.equal(limited.reason, 'projection-limit');checks++;
assert.equal(Object.hasOwn(limited, 'budget'), false, 'An unfinished projection must not claim a maximum');checks++;
assert.equal(Object.hasOwn(limited, 'daysToPlateau'), false, 'An unfinished projection must not claim a day estimate');checks++;
assert.equal(model.estimateProfitPlateau({...model.defaults, dayBoostPct: 1e-308}).complete, false);checks++;
console.log('Profit growth-stop projection checks passed: ' + checks + ' assertions, including direct day-by-day comparisons.');
